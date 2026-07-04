# Requirements Document

## Introduction

This feature delivers a playable prototype of a Rhythm Heaven-style minigame framework, as
described in `framework_conversion.md`. The prototype ships four minigames — one for each of
the four core movement (gesture) types in the touch vocabulary: **Tap**, **Hold**,
**Release**, and **Flick**. Each minigame is defined by data (a JSON minigame definition) plus
a JavaScript controller class, so new minigames can be added without changing framework code.

The prototype is a mobile-first browser game built on Phaser 4 + Vite, rendered in portrait
720x1280, driven by pointer events, and timed with `performance.now()`. It reuses the existing,
tested systems in the codebase (Conductor, AudioManager, LoadingState, Registry,
AssetManifestBuilder, SaveManager, Transitions, ResultState) and adds the net-new rhythm
framework pieces (RhythmClock, CueTimeline, CueScheduler, CueJudger, RhythmScoring,
RhythmSession, TouchGestureRecognizer, RhythmInputManager, RhythmScene, a RhythmMinigame base
plus four controllers, MinigameRegistry, MinigameSelectState).

The prototype requires zero new art or audio; all assets are reused from
`assets/rythm-foundation.assets/`. The runtime flow is
MainMenu → MinigameSelect → LoadingState → RhythmScene → ResultState. Scoring is Rhythm
Heaven-style (accuracy plus perfect/good/barely/miss counts and a result band), not FNF
health/combo-first.

The top technical risks addressed as first-class requirements are: touch gesture recognition,
reconciliation of the input clock (`performance.now()`) with the audio clock
(`AudioManager.currentTime`), judging on gesture-start rather than confirmation time, and
scheduler stability across pause/resume and audio drift.

**Non-goals for this prototype:** replays, perfect-campaign mode, an animation/level editor,
multiple playlists, and retiring the legacy FNF gameplay from the app.

## Glossary

- **Rhythm_Framework**: The shared, minigame-agnostic system that owns timing, scheduling,
  judgement, scoring, input, and scene lifecycle. Comprises RhythmClock, CueTimeline,
  CueScheduler, CueJudger, RhythmScoring, RhythmSession, RhythmInputManager, and RhythmScene.
- **Gesture**: A normalized, user-facing touch action produced by the Touch_Gesture_Recognizer.
  One of `tap`, `holdStart`, `holdTick`, `release`, or `flick`.
- **Movement_Type**: One of the four gesture categories that each get a dedicated minigame:
  Tap, Hold, Release, Flick.
- **Cue**: A scripted timeline event belonging to one minigame run. A cue is either a
  presentation event (visual/audio/animation, `type: "cue"`) or an expected-input event
  (`type: "expect"`).
- **Expectation**: A timeline entry of `type: "expect"` that defines a required Gesture, an
  optional direction, a target beat, and per-cue timing windows.
- **Cue_Timeline**: The ordered collection of all Cues and Expectations for a single minigame run.
- **Cue_Scheduler**: The system that fires timeline events at the correct song position, opens
  and closes input windows, and marks unresolved Expectations as missed.
- **Cue_Judger**: The system that compares a player Gesture against active Expectations and
  returns a Judgement plus a timing offset.
- **Judgement**: The outcome of judging a Gesture against an Expectation. One of `perfect`,
  `good`, `barely`, `miss`, or `wrong`.
- **RhythmClock**: A timing wrapper over the existing Conductor that converts between
  milliseconds, seconds, beats, and steps, and tracks song position from `AudioManager.currentTime`.
- **Conductor**: The existing timing system (`src/core/Conductor.js`) that converts
  ms↔beats↔steps and supports BPM and `timeChanges`.
- **AudioManager**: The existing audio system (`src/audio/AudioManager.js`) exposing
  `currentTime`, `play/seek/pause/resume`, SFX, volumes, mobile Web Audio unlock, and
  `resync`/`forceResync`.
- **Song_Position**: The current playback position of the backing song, in milliseconds,
  derived from `AudioManager.currentTime`.
- **Input_Time**: A timestamp captured from `performance.now()` at the moment a pointer event occurs.
- **Input_Time_Mapping**: The single mapping that converts an Input_Time into a Song_Position,
  applying the SaveManager input-delay offset.
- **Input_Delay_Offset**: A user-configurable calibration value (from SaveManager) added when
  mapping Input_Time to Song_Position to compensate for device input/audio latency.
- **Touch_Gesture_Recognizer**: The net-new system that listens to pointer events on the game
  canvas and emits normalized Gestures with timestamp, position, duration, distance, velocity,
  and direction.
- **RhythmInputManager**: The system that buffers normalized Gestures, applies the
  Input_Time_Mapping, and delivers them to the Cue_Judger.
- **RhythmScoring**: The system that converts Judgements into score, accuracy, and a result band.
- **Result_Band**: A summary rating of a completed run derived from accuracy (e.g. "Superb",
  "OK", "Try Again").
- **RhythmSession**: The per-run object that holds the loaded minigame definition, timeline,
  song, scoring configuration, and accumulated results.
- **RhythmScene**: The Phaser scene that runs a minigame: plays audio, drives the RhythmClock,
  updates the Cue_Scheduler, routes input to the Cue_Judger, and dispatches events to the
  active minigame controller.
- **RhythmMinigame**: The base class/interface for a minigame controller. Owns scene layout,
  sprites/animations, gesture meaning, and feedback presentation.
- **Minigame_Controller**: A concrete subclass of RhythmMinigame for a specific minigame
  (TapClapGame, FillBotGame, ReleaseGame, FlickRallyGame).
- **Minigame_Definition**: A JSON document describing one minigame: id, name, bpm/song,
  assets, allowed gestures, and a timeline of cue/expect entries.
- **MinigameRegistry**: The registry that loads, validates, and lists Minigame_Definitions and
  maps each to its Minigame_Controller class.
- **Cue_Action_Dispatch**: The mechanism that maps a cue's `action`/`onPerfect`/`onGood`/
  `onBarely`/`onMiss` string to a method on the active Minigame_Controller.
- **MinigameSelectState**: The menu scene that lists the four minigames and launches a
  selected minigame.
- **LoadingState**: The existing scene (`src/ui/LoadingState.js`) that shows load progress and
  runs a `prepareCallback` to resolve assets and next-scene data.
- **ResultState**: The existing scene that displays run results.
- **SaveManager**: The existing system (`src/data/SaveManager.js`) for options, input-delay
  compensation, and high scores.
- **Timing_Window**: The per-Expectation set of millisecond tolerances (`perfect`, `good`,
  `barely`) around a target beat used to derive a Judgement.

## Requirements

### Requirement 1: Tap minigame (Tap on beat)

**User Story:** As a player, I want a tap-on-beat minigame, so that I can clap in time with
the music and prove the tap gesture flow.

#### Acceptance Criteria

1. WHERE the Tap minigame is loaded, THE MinigameRegistry SHALL restrict its allowed gestures to `tap`.
2. WHEN a presentation cue in the Tap minigame becomes due, THE RhythmScene SHALL dispatch the cue to the Tap Minigame_Controller through Cue_Action_Dispatch.
3. WHEN a player Gesture of type `tap` is matched to an active Expectation, THE Cue_Judger SHALL return a Judgement based on the Expectation's Timing_Window.
4. WHEN a Judgement is produced for a Tap Expectation, THE RhythmScene SHALL dispatch the corresponding feedback method to the Tap Minigame_Controller through Cue_Action_Dispatch.
5. IF a player Gesture of type other than `tap` is received while a Tap Expectation is active, THEN THE Cue_Judger SHALL return a Judgement of `wrong`.

### Requirement 2: Hold minigame (Hold for duration)

**User Story:** As a player, I want a hold-for-duration minigame, so that I can hold across a
timed span and prove the hold gesture flow.

#### Acceptance Criteria

1. WHERE the Hold minigame is loaded, THE MinigameRegistry SHALL include `hold` in its allowed gestures.
2. WHEN a player begins a hold, THE Touch_Gesture_Recognizer SHALL emit a `holdStart` Gesture after the pointer is held past the hold threshold.
3. WHILE a hold is in progress, THE Touch_Gesture_Recognizer SHALL emit `holdTick` Gestures carrying the elapsed hold duration.
4. WHILE a hold is in progress, THE Hold Minigame_Controller SHALL update its continuous visual state from the reported hold duration.
5. WHEN a hold-duration Expectation is resolved, THE Cue_Judger SHALL return a Judgement derived from how closely the hold duration matched the Expectation's target span within its Timing_Window.

### Requirement 3: Release minigame (Release on beat)

**User Story:** As a player, I want a release-on-beat minigame, so that I can lift my finger on
cue and prove the release gesture flow.

#### Acceptance Criteria

1. WHERE the Release minigame is loaded, THE MinigameRegistry SHALL include `release` in its allowed gestures.
2. WHEN a player lifts the pointer after a hold, THE Touch_Gesture_Recognizer SHALL emit a `release` Gesture carrying the hold duration and the release timestamp.
3. WHEN a `release` Gesture is matched to an active release Expectation, THE Cue_Judger SHALL return a Judgement by comparing the release Song_Position to the Expectation's target beat within its Timing_Window.
4. IF a `release` Gesture arrives before its Expectation's window opens, THEN THE Cue_Judger SHALL return a Judgement of `wrong`.
5. IF a release Expectation's window closes with no `release` Gesture matched, THEN THE Cue_Scheduler SHALL mark the Expectation as `miss`.

### Requirement 4: Flick minigame (Flick on beat with direction)

**User Story:** As a player, I want a directional flick-on-beat minigame, so that I can flick in
a required direction on cue and prove the flick gesture flow.

#### Acceptance Criteria

1. WHERE the Flick minigame is loaded, THE MinigameRegistry SHALL restrict its allowed gestures to `flick` and SHALL declare the required flick directions.
2. WHEN pointer movement before release exceeds the configured distance and velocity thresholds, THE Touch_Gesture_Recognizer SHALL emit a `flick` Gesture carrying distance, velocity, and direction.
3. WHEN a `flick` Gesture is matched to an active flick Expectation that specifies a required direction, THE Cue_Judger SHALL return a Judgement of `wrong` IF the Gesture direction does not match the required direction.
4. WHEN a `flick` Gesture matches both the required direction and the Timing_Window of an active flick Expectation, THE Cue_Judger SHALL return a Judgement based on the timing offset.
5. WHEN a flick Expectation is resolved, THE RhythmScene SHALL dispatch the corresponding feedback method to the Flick Minigame_Controller through Cue_Action_Dispatch.

### Requirement 5: RhythmClock timing and beat↔ms conversion

**User Story:** As a framework developer, I want a single neutral timing source, so that all
minigames share consistent beat and millisecond conversions.

#### Acceptance Criteria

1. WHEN a run starts, THE RhythmClock SHALL initialize from the Minigame_Definition's BPM and offset by wrapping the Conductor.
2. THE RhythmClock SHALL convert a beat value to a millisecond Song_Position and SHALL convert a millisecond value to a beat value.
3. WHEN the RhythmScene provides `AudioManager.currentTime` each frame, THE RhythmClock SHALL update its Song_Position from that value rather than integrating its own clock.
4. WHERE a loaded song carries `timeChanges`, THE RhythmClock SHALL apply those `timeChanges` when converting between beats and milliseconds.
5. WHEN a beat value is converted to milliseconds at load time, THE RhythmClock SHALL produce a value consistent with the Conductor for the same beat and BPM.

### Requirement 6: Cue timeline and scheduler

**User Story:** As a minigame author, I want scripted cues to fire at the right song time, so
that gameplay stays synchronized with the music.

#### Acceptance Criteria

1. WHEN a Cue_Timeline is built from a Minigame_Definition, THE Cue_Scheduler SHALL order all entries by their target Song_Position.
2. WHEN the Song_Position reaches a presentation cue's target time, THE Cue_Scheduler SHALL emit that cue exactly once.
3. WHEN the Song_Position reaches an Expectation's window-open time, THE Cue_Scheduler SHALL open that Expectation's input window.
4. WHEN the Song_Position passes an Expectation's window-close time with the Expectation unresolved, THE Cue_Scheduler SHALL mark the Expectation as `miss` exactly once.
5. WHILE the run is active, THE Cue_Scheduler SHALL track the set of unresolved Expectations.

### Requirement 7: Cue judging on gesture-start timestamp

**User Story:** As a player, I want my timing judged by when I started my gesture, so that
recognition latency does not corrupt my score.

#### Acceptance Criteria

1. WHEN the Touch_Gesture_Recognizer emits a Gesture, THE Gesture SHALL carry the `performance.now()` timestamp captured at gesture-start (`pointerdown`).
2. WHEN the Cue_Judger judges a `tap` or `flick` Gesture, THE Cue_Judger SHALL use the gesture-start timestamp, not the confirmation (`pointerup`) timestamp, as the judged moment.
3. WHEN the Cue_Judger compares a Gesture to an Expectation, THE Cue_Judger SHALL match the Gesture type, match the optional required direction, and compute a timing offset from the judged Song_Position to the target beat.
4. WHEN a Gesture is judged against an Expectation, THE Cue_Judger SHALL return one of `perfect`, `good`, `barely`, `miss`, or `wrong` based on the timing offset and the Timing_Window.
5. IF a Gesture matches an Expectation that has already been resolved and does not allow multiple inputs, THEN THE Cue_Judger SHALL reject the Gesture without producing a duplicate Judgement.

### Requirement 8: Input clock and audio clock reconciliation

**User Story:** As a player, I want input timing to line up with the music, so that judgements
feel accurate on my device.

#### Acceptance Criteria

1. THE RhythmInputManager SHALL convert each Gesture's Input_Time into a Song_Position using a single Input_Time_Mapping.
2. WHEN the RhythmInputManager applies the Input_Time_Mapping, THE RhythmInputManager SHALL add the Input_Delay_Offset from SaveManager.
3. THE Rhythm_Framework SHALL define the Input_Time_Mapping in exactly one location.
4. WHEN a Gesture is buffered, THE RhythmInputManager SHALL preserve the Gesture's original Input_Time alongside the mapped Song_Position.

### Requirement 9: Scheduler stability across pause, resume, and drift

**User Story:** As a player, I want pausing and resuming to keep the game in sync, so that cues
do not misfire after an interruption.

#### Acceptance Criteria

1. WHILE the run is paused, THE Cue_Scheduler SHALL emit no cues and SHALL open no input windows.
2. WHEN the run resumes, THE Cue_Scheduler SHALL continue from the current `AudioManager.currentTime` Song_Position without re-firing already-emitted cues.
3. WHEN the AudioManager performs `resync` or `forceResync`, THE Cue_Scheduler SHALL remain pinned to the corrected `AudioManager.currentTime`.
4. THE Cue_Scheduler SHALL derive Song_Position from `AudioManager.currentTime` each frame rather than integrating an independent clock.

### Requirement 10: Rhythm Heaven-style scoring

**User Story:** As a player, I want accuracy-based scoring with a clear result rating, so that I
know how well I performed overall.

#### Acceptance Criteria

1. WHEN a Judgement is produced, THE RhythmScoring SHALL increment the count for that Judgement category.
2. WHEN a run ends, THE RhythmScoring SHALL compute an overall accuracy value from the Judgement counts.
3. WHEN a run ends, THE RhythmScoring SHALL derive a Result_Band from the overall accuracy.
4. THE RhythmScoring SHALL compute score from accuracy and Judgement counts rather than from a health meter or combo-first model.
5. WHEN a run ends, THE RhythmScoring SHALL produce a result summary containing the score, accuracy, per-category Judgement counts, and Result_Band.

### Requirement 11: Data-driven minigame definitions

**User Story:** As a minigame author, I want to define a minigame in JSON plus a controller
class, so that I can add levels without changing framework code.

#### Acceptance Criteria

1. WHEN a Minigame_Definition is loaded, THE MinigameRegistry SHALL validate that the definition contains id, name, bpm or song reference, allowed gestures, and a timeline.
2. IF a Minigame_Definition fails validation, THEN THE MinigameRegistry SHALL reject the definition and report a descriptive error identifying the invalid field.
3. WHEN a valid Minigame_Definition is loaded, THE MinigameRegistry SHALL map the definition's id to its Minigame_Controller class.
4. WHEN a new Minigame_Definition and its Minigame_Controller are added, THE Rhythm_Framework SHALL run the new minigame without modification to RhythmClock, Cue_Scheduler, Cue_Judger, RhythmScoring, or RhythmScene.
5. THE Cue_Action_Dispatch SHALL map each cue `action`/`onPerfect`/`onGood`/`onBarely`/`onMiss` string to a method on the active Minigame_Controller.
6. IF a cue names an action string with no matching Minigame_Controller method, THEN THE Cue_Action_Dispatch SHALL report a descriptive error identifying the missing method.

### Requirement 12: Runtime flow from menu to result

**User Story:** As a player, I want to pick a minigame, load it, play it, and see my result, so
that I can complete a full play session.

#### Acceptance Criteria

1. WHEN the player opens MinigameSelectState, THE MinigameSelectState SHALL list the four available minigames from the loaded Minigame_Definitions.
2. WHEN the player selects a minigame, THE MinigameSelectState SHALL transition to LoadingState using the Transitions helper.
3. WHEN LoadingState runs its prepareCallback, THE LoadingState SHALL build the RhythmSession and the asset manifest for the selected minigame.
4. WHEN asset loading completes, THE LoadingState SHALL transition to RhythmScene with the built RhythmSession.
5. WHEN a run ends in RhythmScene, THE RhythmScene SHALL transition to ResultState with the RhythmScoring result summary.

### Requirement 13: Asset reuse

**User Story:** As a project stakeholder, I want the prototype to reuse committed assets, so
that no new art or audio is required.

#### Acceptance Criteria

1. THE Rhythm_Framework SHALL source all backing songs, character atlases, countdown graphics, judgement popups, and SFX from `assets/rythm-foundation.assets/`.
2. WHEN a minigame references a backing song, THE RhythmClock SHALL read BPM and `timeChanges` from that song's committed metadata.
3. WHERE a minigame drives character animation, THE Minigame_Controller SHALL use committed Sparrow atlas poses.
4. THE prototype SHALL require zero new art or audio assets.

### Requirement 14: Mobile input and canvas handling

**User Story:** As a mobile player, I want touch input to work without the page scrolling or
zooming, so that flicks and holds behave correctly.

#### Acceptance Criteria

1. THE Touch_Gesture_Recognizer SHALL listen to `pointerdown`, `pointermove`, and `pointerup` events on the game canvas.
2. WHEN a run begins in RhythmScene, THE RhythmScene SHALL set `touch-action: none` on the game canvas.
3. WHEN a run ends or RhythmScene shuts down, THE RhythmScene SHALL restore the canvas `touch-action` to its prior value.
4. THE Rhythm_Framework SHALL render in portrait orientation at 720x1280.
5. WHERE the Web Audio context is suspended on first interaction, THE RhythmScene SHALL reuse the existing AudioManager unlock handling to resume audio.

### Requirement 15: Gesture recognition accuracy and disambiguation

**User Story:** As a player, I want my taps, holds, releases, and flicks recognized correctly,
so that the game responds to what I actually did.

#### Acceptance Criteria

1. WHEN a pointer is pressed and released within the maximum tap duration and under the maximum tap movement, THE Touch_Gesture_Recognizer SHALL classify the interaction as `tap`.
2. WHEN a pointer is held past the hold threshold, THE Touch_Gesture_Recognizer SHALL classify the interaction as a hold rather than a `tap`.
3. WHEN pointer movement before release exceeds the flick distance and velocity thresholds, THE Touch_Gesture_Recognizer SHALL classify the interaction as `flick` rather than `tap`.
4. WHEN a `flick` is classified, THE Touch_Gesture_Recognizer SHALL compute its direction from the vector between gesture-start and release positions.
5. IF a pointer interaction satisfies neither the tap, hold, nor flick thresholds, THEN THE Touch_Gesture_Recognizer SHALL emit no Gesture.

### Requirement 16: Scene lifecycle teardown

**User Story:** As a framework developer, I want RhythmScene to clean up everything it creates,
so that repeated plays do not leak listeners, timers, or objects.

#### Acceptance Criteria

1. WHEN RhythmScene shuts down, THE RhythmScene SHALL remove all pointer event listeners registered by the Touch_Gesture_Recognizer.
2. WHEN RhythmScene shuts down, THE RhythmScene SHALL remove all EventBus subscriptions, cancel all timers and tweens, and null all owned game object references created in `create()`.
3. WHEN RhythmScene shuts down, THE RhythmScene SHALL call `this.events?.off('shutdown', this.shutdown, this)`.
4. WHEN RhythmScene shuts down, THE active Minigame_Controller SHALL release all game objects it created.

### Requirement 17: Testability of gesture recognition and timing

**User Story:** As a framework developer, I want gesture recognition and timing to be unit
testable, so that I can validate behavior without real pointer physics.

#### Acceptance Criteria

1. THE Touch_Gesture_Recognizer SHALL accept synthetic pointer-event sequences with injected `performance.now()` timestamps for testing.
2. WHEN a synthetic pointer sequence is fed to the Touch_Gesture_Recognizer, THE Touch_Gesture_Recognizer SHALL emit the same Gestures it would emit from equivalent real pointer events.
3. THE RhythmClock SHALL accept an injected Song_Position value so beat↔ms conversion can be tested without live audio.
4. THE Cue_Scheduler SHALL accept an injected Song_Position value so cue firing and miss detection can be tested deterministically.
5. FOR ALL beat values, converting a beat to milliseconds via RhythmClock and back to a beat SHALL produce the original beat value within a defined tolerance (round-trip property).

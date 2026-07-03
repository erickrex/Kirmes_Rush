# Rhythm Minigame Framework Conversion Plan

## Goal

Transform the current `fnf-phaser` project from a Friday Night Funkin-style lane rhythm game into a mobile-first browser framework for Rhythm Heaven-style minigames.

The new foundation should support many short rhythm minigames that share timing, audio, input, loading, scoring, saves, menus, and result flow, while each minigame owns its own animation, rules, visual language, and cue meaning.

The project should leave Friday Night Funkin levels and lane gameplay behind. We can keep a small set of existing songs and menu screens temporarily so we have real audio, loading, settings, and navigation while building the new systems.

## Feasibility And Timeline

This conversion is feasible as a mobile-first web app. Phaser, browser pointer events, `performance.now()` timing, and Web Audio are enough for tap, hold, release, and flick rhythm minigames. The main challenge is not whether the browser can do it; the main challenge is scope, polish, animation quality, and careful mobile input/audio handling.

Realistic targets:

| Scope | Estimated time |
| --- | ---: |
| Framework skeleton only | 1-2 weeks |
| First playable mobile prototype | 2-3 weeks |
| Three prototype minigames | 4-6 weeks |
| Solid reusable framework | 6-10 weeks |
| Polished demo with menus, saves, results, calibration, and 3-5 minigames | 2-4 months |
| Full Rhythm Heaven-like game with many polished minigames | 6+ months |

For this codebase, the best first target is a 4-6 week MVP:

- mobile-first browser app
- new rhythm framework route
- shared timing/input/scoring
- one menu flow
- 2-3 simple minigames
- retained FNF songs only as temporary backing tracks
- old FNF gameplay no longer on the main route

A stronger vertical slice should be planned at 8-12 weeks. That version should feel like a real game: mobile UI, calibration, result screens, three polished minigames, reusable cue scripting, debug timing tools, and most FNF assumptions removed from runtime navigation.

The full conversion is likely a 3-6 month effort if the goal is to fully retire FNF concepts, replace menus/saves/data with minigame-native systems, and produce enough polished minigames to feel like a complete product.

Mobile web is viable, but the framework must be designed for phones from the start:

- full-screen portrait-first layout
- large touch zones
- `pointerdown`, `pointermove`, and `pointerup` as the input source
- `touch-action: none` during gameplay
- Web Audio unlocked on first tap
- `performance.now()` timestamps for judgement
- input/audio calibration
- lightweight visuals for mobile GPUs
- optimized assets and short loading paths

Known browser risks:

- audio latency varies by device
- iOS Safari has strict audio unlock behavior
- scroll, zoom, and back-swipe gestures can interfere with flick gameplay
- old phones may struggle with heavy animation or large textures

These are not blockers, but they should be treated as first-class requirements during the MVP instead of polish tasks at the end.

## Product Direction

The new game is not a note highway. It is a collection of cue-and-response rhythm scenes.

FNF-style gameplay:

```txt
song time -> notes scroll in lanes -> player presses matching lane
```

Rhythm Heaven-style gameplay:

```txt
song time -> cue appears or plays -> player performs a contextual touch action
```

The same input gesture can mean different things in different minigames:

- Tap can mean clap, punch, blink, catch, pose, or answer.
- Hold can mean sing, charge, fill, brace, or wait.
- Release can mean stop singing, finish filling, launch, or drop.
- Flick can mean swing, slice, throw, swat, bounce, or serve.

The framework must make those behaviors data-driven enough that new minigames can be added without rewriting timing, input, loading, and scoring every time.

## Core Touch Vocabulary

The mobile browser input layer should support these user-facing gestures:

| Gesture | Low-level pointer events | Common use |
| --- | --- | --- |
| Tap | `pointerdown` then short `pointerup` | Clap, punch, catch, button hit |
| Hold | `pointerdown` held past threshold | Charge, sing, fill, wait |
| Release | `pointerup` after hold | Finish fill, stop singing, launch |
| Flick | Fast move ending in release | Swing, slice, throw, swat |

Internally the browser should track raw input first:

```txt
pointerdown
pointermove
pointerup
position
duration
distance
velocity
direction
timestamp from performance.now()
```

Then the gesture recognizer emits normalized events:

```js
{
  type: 'flick',
  timestamp: 12345.67,
  position: { x: 180, y: 420 },
  startPosition: { x: 160, y: 470 },
  durationMs: 82,
  distancePx: 54,
  velocityPxPerMs: 0.66,
  direction: 'up'
}
```

## Core Mechanics To Support

These mechanics are enough to cover a large set of Rhythm Heaven-inspired minigames:

| Mechanic | Description | Example |
| --- | --- | --- |
| `tap_on_beat` | Tap at a target beat | Clap with a crowd |
| `release_on_beat` | Lift at a target beat | Stop singing on cue |
| `hold_for_duration` | Hold across a timed span | Fill a robot |
| `flick_on_beat` | Flick at a target beat | Hit a ball back |
| `flick_directional` | Flick with a required direction | Slice up/down/left/right |
| `call_and_response` | Hear/see a pattern, repeat it | Mimic a leader |
| `rapid_sequence` | Perform several inputs in rhythm | Fast claps or punches |
| `charged_action` | Hold first, then release or flick later | Charge then launch |
| `fakeout_or_delay` | Cue changes expected timing | Wait longer than normal |
| `variable_window` | Cue uses custom timing strictness | Boss cue or tutorial cue |
| `listen_only` | Visual/audio event with no input expected | Setup animation |
| `branch_feedback` | Different animation based on judgement | Perfect/hit/barely/miss |

## What We Can Reuse

### Keep And Generalize

| Area | Current files | Reuse plan |
| --- | --- | --- |
| Phaser bootstrap | `src/main.js`, `src/phaser.js` | Keep. Rename comments later if needed. |
| Timing | `src/core/Conductor.js` | Keep as beat/time foundation. Wrap with a rhythm-focused clock API. |
| Events | `src/core/EventBus.js` | Keep. Add rhythm event names. |
| Loading | `src/ui/LoadingState.js` | Keep. Use for minigame asset manifests. |
| Audio | `src/audio/AudioManager.js`, `src/audio/VoicesGroup.js` | Keep AudioManager. VoicesGroup is optional for songs with stems. |
| Input timestamping | `src/input/InputSystem.js` | Reuse ideas from `PreciseInput` and `InputBuffer`; add touch gesture recognition. |
| Saves/options | `src/data/SaveManager.js` | Keep and refactor progress from weeks/songs toward minigames/medals. |
| Registries | `src/core/Registry.js` | Keep for minigame definitions, playlists, asset packs. |
| Menus | `src/ui/BaseMenuState.js`, `MainMenuState`, `OptionsState`, `LoadingState`, `ResultState` | Keep initially. Rename and reskin after framework is stable. |
| Transitions | `src/graphics/Transitions.js` | Keep. |
| Performance | `src/core/PerformanceMonitor.js` | Keep. Useful for mobile performance. |
| Asset path helpers | `src/utils/AssetPathResolver.js`, `GameDataPaths.js` | Keep, but add rhythm asset roots. |
| Tests/tooling | Vitest, ESLint, typecheck, property tests | Keep and expand. |

### Extract Or Adapt

| Area | Current files | Adaptation |
| --- | --- | --- |
| Scoring windows | `src/play/Scoring.js` | Extract judgement windows into neutral `RhythmScoring`. Remove FNF labels where needed. |
| Play scene lifecycle | `src/scenes/PlayScene.js` | Use as reference for new `RhythmScene`, but do not keep lane-specific behavior. |
| Play orchestration | `src/play/PlayState.js` | Use the module pattern as inspiration only. Build a new rhythm state. |
| Replay | `src/replay/ReplaySystem.js` | Adapt from lane input events to normalized gesture/cue results. |
| Level/session builders | `src/levels/*` | Replace song/level assumptions with minigame/session definitions. Some manifest-loading patterns can remain. |
| HUD/result flow | `ScoreDisplay`, `GradeDisplay`, `ResultState` | Keep result screen pattern. Replace combo/health-heavy assumptions. |

### Retire Or Move To Legacy

| FNF-specific area | Current files | Plan |
| --- | --- | --- |
| Note highway | `Strumline`, `NoteSprite`, `SustainTrail`, `NoteProcessor`, `InputManager` | Retire from main flow. Keep in `legacy/fnf` only if needed. |
| Character/stage registries | `CharacterRegistry`, `StageRegistry`, `NoteStyleRegistry` | Replace with minigame asset registries. Archive or remove once no longer referenced. |
| FNF gameplay visuals | `Character`, `Stage`, `HealthBar`, `HealthIcon`, `NoteSplash`, `ComboPopup`, `OpponentIndicator`, `GeneratedGameplaySkin` | Retire from framework. Some animation helper ideas can be reused. |
| FNF charts | `ChartParser`, FNF chart assets | Stop using for new gameplay. Keep a few audio files, not the charts. |
| Week/story/freeplay assumptions | `StoryMenuState`, `FreeplayState`, pieces of `SaveManager` | Replace with playlists, minigame select, challenge sets, medals. |

## Target Architecture

Add a new neutral rhythm framework beside the current code first. Once it is proven, route the app to it and remove old FNF gameplay.

Proposed source layout:

```txt
fnf-phaser/src/
  rhythm/
    core/
      RhythmClock.js
      CueTimeline.js
      CueScheduler.js
      CueJudger.js
      RhythmScoring.js
      RhythmSession.js
    input/
      TouchGestureRecognizer.js
      RhythmInputManager.js
      GestureBuffer.js
    minigames/
      RhythmMinigame.js
      MinigameRegistry.js
      MinigameLoader.js
      TapClapGame.js
      HoldReleaseGame.js
      FlickRallyGame.js
    scene/
      RhythmScene.js
      RhythmDebugOverlay.js
    ui/
      RhythmHud.js
      RhythmResultAdapter.js
    data/
      RhythmDataTypes.js
      RhythmAssetManifestBuilder.js
```

Proposed asset/data layout:

```txt
fnf-phaser/assets/
  data/
    rhythm/
      minigames/
        tap-clap.json
        fill-bot.json
        flick-rally.json
      playlists/
        demo.json
      songs/
        tutorial-loop.json
  rhythm/
    minigames/
      tap-clap/
      fill-bot/
      flick-rally/
    shared/
      ui/
      sounds/
      backgrounds/
```

## Runtime Flow

The new default runtime should become:

```txt
main.js
  -> TitleState or MainMenuState
  -> MinigameSelectState
  -> LoadingState
       prepareCallback builds RhythmSession and asset manifest
  -> RhythmScene
       creates RhythmGameState
       starts AudioManager
       starts RhythmClock
       updates CueScheduler
       sends input to CueJudger
       sends cue/judgement events to active minigame controller
  -> ResultState
```

Old FNF path can stay available temporarily behind a debug option:

```txt
Debug menu -> Legacy FNF PlayScene
```

But it should stop being the primary route.

## Main Framework Modules

### `RhythmClock`

Purpose: provide one neutral timing source for songs and minigames.

Responsibilities:

- Wrap or use `Conductor`.
- Convert between seconds, milliseconds, beats, and steps.
- Track song position from `AudioManager.currentTime`.
- Support BPM changes later, but start with constant BPM.
- Expose `nowMs`, `nowBeat`, `beatToMs()`, `msToBeat()`.

Initial API:

```js
clock.start({ bpm: 120, offsetMs: 0 });
clock.update(audioManager.currentTime);
clock.beatToMs(16);
clock.msToBeat(8000);
clock.getSongPositionMs();
clock.getSongBeat();
```

### `TouchGestureRecognizer`

Purpose: convert browser pointer input into normalized gestures.

Responsibilities:

- Listen to pointer events on the game canvas.
- Disable page scroll/zoom during gameplay with CSS and pointer handling.
- Emit `tap`, `holdStart`, `holdTick`, `release`, and `flick`.
- Include timestamps from `performance.now()`.
- Include direction, velocity, distance, duration, and position.
- Prefer single-finger input for the first version.

Gesture rules:

```txt
tap: down/up under max duration and max movement
holdStart: down held past hold threshold
release: any up event, with hold duration
flick: movement distance and velocity above threshold before up
```

### `RhythmInputManager`

Purpose: buffer normalized gestures and deliver them to the cue judging system.

Responsibilities:

- Queue gestures with precise timestamps.
- Convert gesture timestamp to song position using current clock/audio time.
- Apply input delay compensation from `SaveManager`.
- Optionally keep a small early-input buffer.
- Expose consumed input for replay/debug.

This replaces lane-specific `InputManager`.

### `CueTimeline`

Purpose: hold all scripted events for one minigame run.

Timeline entries should support:

- Visual cue events.
- Audio cue events.
- Expected input windows.
- Animation commands.
- Branch feedback.
- Debug labels.

Example:

```js
{
  id: 'ball-01-hit',
  beat: 8,
  type: 'expect',
  gesture: 'flick',
  direction: 'up',
  targetBeat: 8,
  windowMs: {
    perfect: 45,
    good: 90,
    barely: 140
  },
  tags: ['rally', 'ball']
}
```

### `CueScheduler`

Purpose: fire timeline events at the correct song time.

Responsibilities:

- Sort events by time.
- Emit upcoming cue warnings.
- Emit due visual/audio cue events.
- Open and close input windows.
- Track unresolved expected inputs.
- Mark missed expectations when time passes.

### `CueJudger`

Purpose: compare player gestures against active expectations.

Responsibilities:

- Match gesture type.
- Match optional direction.
- Match optional touch zone.
- Compare input song position to target time.
- Return judgement and timing offset.
- Prevent duplicate hits unless the cue allows multiple inputs.

Judgements should be neutral:

```txt
perfect
good
barely
miss
wrong
early
late
```

### `RhythmScoring`

Purpose: convert cue judgements into score, accuracy, medals, and result summary.

Unlike FNF, the default should not be health/combo-first. Rhythm Heaven-style scoring should prioritize:

- Overall rhythm accuracy.
- Number of perfect/good/barely/miss judgements.
- Optional medal threshold.
- Optional "superb", "ok", "try again" result bands.
- Optional perfect-campaign mode later.

### `RhythmMinigame`

Purpose: base class/interface for each minigame controller.

Each minigame owns:

- Scene layout.
- Sprites/animations.
- Cue-specific visual changes.
- Gesture meaning.
- Feedback animations.
- Tutorial or practice overlays if needed.

Base API:

```js
class RhythmMinigame {
  constructor(scene, session) {}
  preloadManifest() {}
  create() {}
  update(time, delta, rhythmContext) {}
  onCue(event) {}
  onInput(gesture) {}
  onJudgement(result) {}
  onMiss(expectation) {}
  destroy() {}
}
```

The framework owns timing and judgement. The minigame owns meaning and presentation.

## Data Model

### Minigame Definition

Example file: `assets/data/rhythm/minigames/flick-rally.json`

```json
{
  "version": "1.0.0",
  "id": "flick-rally",
  "name": "Flick Rally",
  "orientation": "portrait",
  "bpm": 120,
  "music": {
    "key": "song-tutorial-inst",
    "path": "assets/funkin.assets/songs/tutorial/Inst.ogg"
  },
  "assets": [
    {
      "type": "image",
      "key": "rally-bg",
      "path": "assets/rhythm/minigames/flick-rally/bg.png"
    }
  ],
  "input": {
    "allowedGestures": ["flick"],
    "flickDirections": ["up"]
  },
  "timeline": [
    {
      "id": "serve-01",
      "beat": 4,
      "type": "cue",
      "action": "opponentServe"
    },
    {
      "id": "return-01",
      "beat": 6,
      "type": "expect",
      "gesture": "flick",
      "direction": "up",
      "windowMs": {
        "perfect": 45,
        "good": 90,
        "barely": 140
      },
      "onPerfect": "returnPerfect",
      "onGood": "returnGood",
      "onBarely": "returnBarely",
      "onMiss": "missBall"
    }
  ]
}
```

### Playlist Definition

Example file: `assets/data/rhythm/playlists/demo.json`

```json
{
  "version": "1.0.0",
  "id": "demo",
  "name": "Demo Set",
  "items": [
    {
      "minigameId": "tap-clap",
      "songId": "tutorial"
    },
    {
      "minigameId": "fill-bot",
      "songId": "bopeebo"
    },
    {
      "minigameId": "flick-rally",
      "songId": "fresh"
    }
  ]
}
```

## First Prototype Minigames

Build three small minigames first. They should prove the framework, not final art quality.

### 1. Tap Clap

Purpose: prove `tap_on_beat`, scheduler, judger, score, and result flow.

Gameplay:

- Character or icon claps on beat.
- Player taps in time.
- Visual feedback changes face/body pose.

Systems covered:

- Tap recognition.
- Basic cue events.
- Basic expected input windows.
- Result screen.

### 2. Fill Bot

Purpose: prove hold and release.

Gameplay:

- Player touches and holds to fill a meter/robot.
- Player releases on a target beat.
- Early release underfills.
- Late release overfills.

Systems covered:

- Hold start.
- Hold duration.
- Release judgement.
- Continuous visual state driven by hold progress.

### 3. Flick Rally

Purpose: prove flick and directional flick.

Gameplay:

- Object travels toward player.
- Player flicks upward on beat to return it.
- Direction and timing both matter.

Systems covered:

- Flick recognition.
- Direction detection.
- Cue anticipation.
- Moving object animation synced to beat.

## Migration Phases

### Phase 0: Preserve A Working Baseline

Tasks:

- Keep current tests green before large movement.
- Do not delete FNF gameplay immediately.
- Add a feature flag or debug menu route for the new rhythm framework.
- Document current app routes and scene keys.

Exit criteria:

- Existing app still runs.
- A new empty `RhythmScene` can be launched from the menu or debug route.

### Phase 1: Create Neutral Framework Skeleton

Tasks:

- Add `src/rhythm/` directory.
- Add `RhythmClock`, `RhythmSession`, `CueTimeline`, `CueScheduler`, `CueJudger`.
- Add neutral data typedefs.
- Add unit tests for time conversion, cue ordering, event dispatch, and judgement windows.

Reuse:

- `Conductor`
- `EventBus`
- `Registry`
- Vitest setup

Exit criteria:

- Timeline events fire deterministically in tests.
- A cue at beat 8 maps to the expected millisecond time.
- Misses are emitted when the song passes an unresolved expected input.

### Phase 2: Build Mobile Touch Input

Tasks:

- Add `TouchGestureRecognizer`.
- Add `RhythmInputManager`.
- Attach pointer listeners to the game canvas.
- Add CSS/browser protections for mobile play:
  - `touch-action: none`
  - no page scroll during gameplay
  - safe-area layout
  - full-screen responsive canvas
- Normalize timestamps into song position.
- Add gesture thresholds to options/debug config.

Reuse:

- `PreciseInput` timestamp ideas
- `InputBuffer`
- `SaveManager` input delay compensation
- Web Audio unlock listener patterns already fixed in menus/play scene

Exit criteria:

- Tests cover tap, hold, release, flick, direction, velocity threshold, and false positives.
- Manual mobile browser test confirms the page does not scroll while playing.

### Phase 3: Create `RhythmScene`

Tasks:

- Add `src/rhythm/scene/RhythmScene.js`.
- Use `LoadingState` to preload minigame assets.
- Use `AudioManager` to play backing music.
- Use `RhythmClock` to sync scheduler to audio time.
- Own lifecycle cleanup for input, audio, timeline, minigame controller, and debug overlay.
- Emit result data to `ResultState`.

Reuse:

- `PlayScene` lifecycle as reference only.
- `AudioManager`.
- `LoadingState`.
- `Transitions`.

Exit criteria:

- `RhythmScene` can start, play a song, update timing, and exit to result.
- Shutdown removes all listeners and destroys owned objects.

### Phase 4: Build Minigame Registry And Loader

Tasks:

- Add `MinigameRegistry`.
- Add `RhythmAssetManifestBuilder`.
- Add JSON validation for minigame definitions.
- Add a demo playlist.
- Allow a minigame definition to map to a JS controller class.

Reuse:

- `Registry`
- `LevelSystem` manifest validation patterns
- `AssetManifestBuilder` asset queueing pattern

Exit criteria:

- Menu can list minigames from JSON.
- Loading a minigame queues its assets and starts `RhythmScene`.

### Phase 5: Build First Vertical Slice

Tasks:

- Add `TapClapGame`.
- Use one retained FNF song as backing audio, likely `tutorial`.
- Script 8 to 16 simple tap cues.
- Display real judgement feedback.
- Route to result screen.

Exit criteria:

- On mobile browser, player can launch Tap Clap, tap in rhythm, receive feedback, and see result.
- No FNF note lanes, receptors, health bar, or opponent logic are involved.

### Phase 6: Add Hold/Release And Flick Minigames

Tasks:

- Add `FillBotGame`.
- Add `FlickRallyGame`.
- Add reusable animation helpers if repeated patterns appear.
- Add debug timing overlay showing beat, cue id, input offset, and judgement.

Exit criteria:

- The framework supports tap, hold, release, and flick in separate games.
- Minigames share the same scheduler, input manager, judger, scoring, loading, and result flow.

### Phase 7: Convert Menus And Saves

Tasks:

- Rename or repurpose `LevelSelectState` into `MinigameSelectState`.
- Replace week/story/freeplay assumptions with:
  - playlists
  - minigame list
  - medals/results
  - practice/debug entries
- Update `SaveManager`:
  - `completedSongs` -> completed minigames or sessions
  - high scores by `minigameId`
  - medals by `minigameId`
  - options remain mostly reusable

Exit criteria:

- Main menu launches the new minigame select.
- FNF story/freeplay routes are no longer primary navigation.
- Saves persist minigame results.

### Phase 8: Retire FNF Gameplay From Main App

Tasks:

- Remove default references to `PlayScene` and `PlayState`.
- Move FNF-specific modules to `src/legacy/fnf/` or delete them after confidence is high.
- Remove FNF-specific registries from runtime boot.
- Keep only selected audio assets needed for demos, if licensing/project goals allow.
- Replace FNF-specific constants with rhythm-neutral constants.

Exit criteria:

- Production app has no dependency on note lanes, FNF charts, FNF characters, or FNF stages.
- Legacy FNF code is either isolated or removed.
- Tests no longer rely on FNF gameplay except any explicit legacy tests.

### Phase 9: Mobile Polish And Authoring Tools

Tasks:

- Add calibration screen for input/audio offset.
- Add minigame debug editor overlay:
  - current beat
  - upcoming cues
  - active input windows
  - last gesture
  - timing offset
- Add touch-zone visualizer.
- Add JSON schema checks for minigame definitions.
- Add a simple script to validate timelines against song BPM/duration.

Exit criteria:

- A designer/developer can add a new JSON timeline and controller without touching framework internals.
- Mobile play feels responsive and readable.

## Testing Strategy

### Unit Tests

Add tests for:

- `RhythmClock`
  - beat to ms
  - ms to beat
  - offset handling
  - BPM changes later
- `TouchGestureRecognizer`
  - tap
  - hold start
  - release
  - flick
  - directional flick
  - movement below threshold should not flick
  - long touch should not tap
- `CueScheduler`
  - cue ordering
  - event firing once
  - missed expectations
  - pause/resume behavior
- `CueJudger`
  - perfect/good/barely/miss windows
  - wrong gesture
  - wrong direction
  - duplicate input prevention
- `RhythmScoring`
  - result bands
  - medal thresholds
  - accuracy calculation

### Integration Tests

Add tests for:

- Loading a minigame definition through `LoadingState`.
- Starting `RhythmScene`.
- Feeding scripted gestures and receiving expected judgements.
- Completing a minigame and entering `ResultState`.
- Shutdown cleanup for pointer listeners, scheduler, audio, and minigame controller.

### Property Tests

Keep the current useful property-test style and add:

- Timeline events must never fire out of order.
- Every expected input must resolve to hit/miss exactly once.
- Every pointer listener registered by `RhythmScene` must be removed on shutdown.
- Every minigame JSON fixture must satisfy required schema fields.

### Manual Mobile QA

Test on:

- iOS Safari
- Android Chrome
- Desktop Chrome device emulation

Checklist:

- First tap unlocks audio.
- Gameplay does not scroll page.
- Flick does not trigger browser navigation.
- Input feels consistent after repeated attempts.
- Canvas scales correctly in portrait.
- Text and touch targets fit small screens.

## Design Rules For Minigames

Each minigame should obey these rules:

- One primary gesture vocabulary per game at first.
- Clear audio cue before expected input.
- Clear visual cue before expected input.
- Immediate feedback on input.
- Miss feedback should be readable but not overly punishing.
- Animations should be timed from the same beat clock as judgement.
- Avoid hidden rules. If timing changes, teach it with cues.
- Keep mobile touch zones large and forgiving.

## Risk Areas

### Browser Audio Latency

Risk:

- Mobile browsers vary in audio start latency and output latency.

Plan:

- Keep `performance.now()` timestamping.
- Convert input event time to song position.
- Keep input delay compensation option.
- Add calibration screen.

### Gesture Ambiguity

Risk:

- Tap vs flick and hold vs tap can be misclassified.

Plan:

- Build tests around thresholds.
- Add debug overlay for recognized gesture.
- Tune thresholds per device class if needed.

### Animation Authoring Cost

Risk:

- Rhythm Heaven-style games need clear, charming, heavily timed animations.

Plan:

- Start with primitive shapes and simple sprites.
- Make animation commands data-driven where practical.
- Only abstract after two or three minigames reveal real duplication.

### Over-abstracting Too Early

Risk:

- A giant scripting engine could slow development before we know the patterns.

Plan:

- Build three prototype minigames first.
- Keep the framework small:
  - scheduler
  - judger
  - input
  - scoring
  - session loading
- Let minigame controllers own unique behavior.

### FNF Coupling

Risk:

- Existing names and assumptions leak into the new framework.

Plan:

- Put new code under `src/rhythm`.
- Do not import from `src/play` in new runtime except temporary scoring/reference code.
- Rename data concepts from song/week/level to minigame/playlist/session over time.

## Suggested First Milestone

Build a playable vertical slice:

```txt
Main Menu
  -> Minigame Select
  -> LoadingState
  -> Tap Clap minigame using tutorial Inst.ogg
  -> ResultState
```

Minimum scope:

- `RhythmScene`
- `RhythmClock`
- `CueTimeline`
- `CueScheduler`
- `CueJudger`
- `TouchGestureRecognizer`
- `RhythmInputManager`
- `RhythmScoring`
- `TapClapGame`
- one JSON minigame definition
- one retained song
- one result summary

Do not include yet:

- Multiple playlists
- BPM changes
- Replay
- Perfect campaign
- Complex animation editor
- Old FNF gameplay integration

## Definition Of Done For The Framework Foundation

The foundation is ready when:

- A new minigame can be added with:
  - one JSON definition
  - one controller class
  - assets
  - menu entry
- The minigame can use tap, hold, release, or flick without changing framework code.
- Timing and judgement are shared across minigames.
- Loading and result flow are shared.
- Mobile browser input is reliable.
- Old FNF lane gameplay is not part of the main route.
- Tests cover the core timing/input/judgement systems.

## Practical File-Level Roadmap

### Add

```txt
src/rhythm/core/RhythmClock.js
src/rhythm/core/CueTimeline.js
src/rhythm/core/CueScheduler.js
src/rhythm/core/CueJudger.js
src/rhythm/core/RhythmScoring.js
src/rhythm/core/RhythmSession.js
src/rhythm/input/TouchGestureRecognizer.js
src/rhythm/input/RhythmInputManager.js
src/rhythm/input/GestureBuffer.js
src/rhythm/minigames/RhythmMinigame.js
src/rhythm/minigames/MinigameRegistry.js
src/rhythm/minigames/TapClapGame.js
src/rhythm/minigames/FillBotGame.js
src/rhythm/minigames/FlickRallyGame.js
src/rhythm/scene/RhythmScene.js
src/rhythm/scene/RhythmDebugOverlay.js
src/rhythm/data/RhythmAssetManifestBuilder.js
src/ui/MinigameSelectState.js
assets/data/rhythm/minigames/*.json
assets/data/rhythm/playlists/demo.json
```

### Keep Initially

```txt
src/ui/TitleState.js
src/ui/MainMenuState.js
src/ui/OptionsState.js
src/ui/LoadingState.js
src/ui/ResultState.js
src/ui/BaseMenuState.js
src/core/Conductor.js
src/core/EventBus.js
src/core/Registry.js
src/audio/AudioManager.js
src/data/SaveManager.js
src/graphics/Transitions.js
```

### Retire From Main Route

```txt
src/scenes/PlayScene.js
src/play/PlayState.js
src/play/Strumline.js
src/play/NoteSprite.js
src/play/NoteProcessor.js
src/play/InputManager.js
src/play/SustainTrail.js
src/data/parsers/ChartParser.js
src/data/registries/CharacterRegistry.js
src/data/registries/StageRegistry.js
src/data/registries/NoteStyleRegistry.js
```

### Keep As Temporary Test Assets

```txt
assets/data/manifests/tutorial.json
assets/data/manifests/week1.json
assets/funkin.assets/songs/tutorial/Inst.ogg
assets/funkin.assets/songs/bopeebo/Inst.ogg
assets/funkin.assets/songs/fresh/Inst.ogg
```

Use those only as backing tracks while the new rhythm framework comes online.

## Recommended Implementation Order

1. Add `src/rhythm/core` with tests.
2. Add touch gesture recognition with tests.
3. Add `RhythmScene` that can play audio and show debug timing.
4. Add `TapClapGame` and JSON timeline.
5. Route one menu item to the new scene.
6. Add result flow and save result.
7. Add `FillBotGame`.
8. Add `FlickRallyGame`.
9. Convert `LevelSelectState` into `MinigameSelectState`.
10. Remove old FNF gameplay from the default app route.

This order keeps the app runnable while moving the center of gravity away from FNF lane gameplay.

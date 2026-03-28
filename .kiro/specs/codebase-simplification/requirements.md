# Requirements Document

## Introduction

This specification covers the simplification and refactoring of the fnf-phaser codebase (a Friday Night Funkin' Phaser.js port). The goal is to reduce code duplication across registries, menu states, and the monolithic PlayState, while introducing cleaner patterns for scoring and shared utilities. All existing tests must continue to pass after refactoring.

## Glossary

- **Registry_Factory**: The `createRegistry()` function in `Registry.js` that generates config-driven registry singletons with validation, cleaning, and caching
- **Concrete_Registry**: A registry created via Registry_Factory (NoteStyleRegistry, StageRegistry, CharacterRegistry, SongRegistry)
- **BaseMenuState**: The shared Phaser.Scene base class for menu screens, providing input binding, sound helpers, transitions, and background creation
- **Menu_State**: A concrete menu scene extending BaseMenuState (MainMenuState, FreeplayState, StoryMenuState, OptionsState)
- **PlayState**: The 1600+ line class managing all gameplay: initialization, input, note processing, scoring, characters, camera, and state transitions
- **Conductor**: The singleton timing engine that tracks BPM, beats, steps, and measures
- **Scoring_System**: One of three scoring algorithms (Legacy, Week7, PBOT1) that determine note scores and judgements
- **Scoring_Strategy**: An object implementing `scoreNote(msTiming)`, `judgeNote(msTiming)`, and `getMissScore()` for a specific scoring algorithm
- **Asset_Path_Resolver**: A utility function that resolves prefixed asset paths (e.g., `shared:`, `default:`) to filesystem paths

## Requirements

### Requirement 1: Enhanced Registry Factory with Common Method Generation

**User Story:** As a developer, I want the Registry_Factory to auto-generate common accessor, lister, and path-builder methods, so that Concrete_Registries do not duplicate boilerplate code.

#### Acceptance Criteria

1. WHEN a Concrete_Registry is created with a `createRegistry()` config containing an `entityName` property, THE Registry_Factory SHALL generate `get<EntityName>Data(id)`, `get<EntityName>Name(id)`, `list<EntityName>Ids()`, `get<EntityName>Path(id)`, `get<EntityName>DisplayInfo(id)`, and `toString()` methods on the registry prototype
2. WHEN a generated accessor method is called with a valid entry ID, THE Concrete_Registry SHALL return the corresponding entry data by delegating to `fetchEntry()`
3. WHEN a generated accessor method is called with an ID that does not exist, THE Concrete_Registry SHALL return `null`
4. WHEN a Concrete_Registry provides a custom method with the same name as a generated method in the `methods` option, THE Registry_Factory SHALL use the custom method instead of the generated one
5. THE Registry_Factory SHALL accept an optional `displayInfoFields` array in the config to specify which entry fields are included in the generated `getDisplayInfo()` method
6. WHEN a Concrete_Registry is created, THE Registry_Factory SHALL generate a `toString()` method that returns `<RegistryId>Registry(<count> <entityName>s)` unless a custom `toString` is provided

### Requirement 2: Shared Asset Path Resolution Utility

**User Story:** As a developer, I want a single shared Asset_Path_Resolver module, so that asset path resolution logic is not duplicated across NoteStyleRegistry, StageRegistry, and CharacterRegistry.

#### Acceptance Criteria

1. THE Asset_Path_Resolver SHALL resolve paths with the `shared:` prefix to `images/shared/<path>`
2. THE Asset_Path_Resolver SHALL resolve paths with the `default:` prefix to `images/preload/<path>`
3. WHEN a path contains a custom prefix in the format `<prefix>:<path>`, THE Asset_Path_Resolver SHALL resolve the path to `images/<prefix>/<path>`
4. WHEN a path contains no prefix, THE Asset_Path_Resolver SHALL resolve the path to `images/<path>`
5. IF a null or empty path is provided, THEN THE Asset_Path_Resolver SHALL return `null`
6. WHEN NoteStyleRegistry, StageRegistry, or CharacterRegistry need to resolve an asset path, THE Concrete_Registry SHALL delegate to the shared Asset_Path_Resolver instead of using a local implementation

### Requirement 3: BaseMenuState List-Based Navigation Absorption

**User Story:** As a developer, I want BaseMenuState to provide a standard list-based navigation pattern, so that Menu_States do not duplicate index wrapping, transition guards, scroll sounds, and selection rendering.

#### Acceptance Criteria

1. THE BaseMenuState SHALL provide `onNavigateUp()` and `onNavigateDown()` methods that decrement and increment a `selectedIndex` property with wrapping, guard against `transitioning === true`, and call `playScrollSound()` followed by `updateSelection()`
2. THE BaseMenuState SHALL provide a `getItemCount()` method that subclasses override to return the number of navigable items
3. THE BaseMenuState SHALL provide a default `getInputBindings()` that binds UP/W to `onNavigateUp`, DOWN/S to `onNavigateDown`, ENTER/SPACE to `onSelect`, and ESC/BACKSPACE to `onBack`
4. WHEN a Menu_State needs additional bindings beyond the default set, THE Menu_State SHALL call `super.getInputBindings()` and append its extra bindings
5. THE BaseMenuState SHALL provide a default `onSelect()` method that guards against `transitioning === true`, sets `transitioning = true`, calls `playConfirmSound()`, and invokes an overridable `executeSelection()` method
6. THE BaseMenuState SHALL provide a default `onBack()` method that guards against `transitioning === true`, sets `transitioning = true`, calls `playCancelSound()`, and invokes an overridable `executeBack()` method
7. WHEN `onNavigateUp()` is called and `selectedIndex` is 0, THE BaseMenuState SHALL wrap `selectedIndex` to `getItemCount() - 1`
8. WHEN `onNavigateDown()` is called and `selectedIndex` is `getItemCount() - 1`, THE BaseMenuState SHALL wrap `selectedIndex` to 0

### Requirement 4: PlayState Decomposition into Focused Modules

**User Story:** As a developer, I want PlayState to delegate responsibilities to focused modules, so that the class is under 400 lines and each concern is independently testable.

#### Acceptance Criteria

1. THE PlayState SHALL delegate note hit detection, miss checking, opponent note processing, and ghost miss handling to a NoteProcessor module
2. THE PlayState SHALL delegate input queue processing, note input handling, and note release handling to an InputManager module
3. THE PlayState SHALL delegate health tracking, score tracking, combo tracking, and tally updates to a GameplayState module
4. THE PlayState SHALL delegate camera focus, camera zoom, and camera event handling to a CameraController module
5. THE PlayState SHALL delegate countdown sequencing, song start, song end, and game-over triggering to a SongFlowController module
6. WHEN a module needs to communicate with PlayState or other modules, THE module SHALL use the EventBus for decoupled communication
7. THE PlayState SHALL remain the single orchestrator that creates, wires, and updates all modules in its `update()` loop
8. WHEN PlayState is destroyed, THE PlayState SHALL call `destroy()` on each module to release resources and event listeners

### Requirement 5: Scoring Strategy Pattern

**User Story:** As a developer, I want each scoring algorithm to be a separate Scoring_Strategy object, so that the Scoring class dispatches by lookup instead of switch statements.

#### Acceptance Criteria

1. THE Scoring_System SHALL define each scoring algorithm (Legacy, Week7, PBOT1) as a separate Scoring_Strategy object with `scoreNote(msTiming)`, `judgeNote(msTiming)`, and `getMissScore()` methods
2. THE Scoring class SHALL maintain a registry mapping each ScoringSystem enum value to its corresponding Scoring_Strategy object
3. WHEN `Scoring.scoreNote(msTiming, scoringSystem)` is called, THE Scoring class SHALL look up the Scoring_Strategy for the given scoringSystem and delegate to its `scoreNote()` method
4. WHEN `Scoring.judgeNote(msTiming, scoringSystem)` is called, THE Scoring class SHALL look up the Scoring_Strategy for the given scoringSystem and delegate to its `judgeNote()` method
5. WHEN `Scoring.getMissScore(scoringSystem)` is called, THE Scoring class SHALL look up the Scoring_Strategy for the given scoringSystem and delegate to its `getMissScore()` method
6. IF an unrecognized scoringSystem value is provided, THEN THE Scoring class SHALL fall back to the PBOT1 Scoring_Strategy
7. THE Scoring class public API (`scoreNote`, `judgeNote`, `getMissScore`, `calculateRank`, `createTallies`, `updateTalliesOnHit`, `updateTalliesOnMiss`, `doesJudgementBreakCombo`, `getHealthBonus`, `compareRanks`, `getRankValue`, `tallyCompletion`) SHALL remain unchanged so existing callers require no modifications

### Requirement 6: Conductor Singleton Cleanup

**User Story:** As a developer, I want the Conductor class to have a single way to access the singleton, so that the API is unambiguous.

#### Acceptance Criteria

1. THE Conductor class SHALL provide the singleton via the `Conductor.instance` static getter only
2. THE Conductor class SHALL remove the `getInstance()` static method
3. WHEN code currently calls `Conductor.getInstance()`, THE codebase SHALL be updated to use `Conductor.instance` instead
4. THE Conductor class SHALL retain the `Conductor.reset()` static method for creating fresh instances during song transitions

### Requirement 7: Backward Compatibility and Test Preservation

**User Story:** As a developer, I want all refactoring to preserve existing public APIs and pass all existing tests, so that no downstream code breaks.

#### Acceptance Criteria

1. WHEN any module is refactored, THE module SHALL maintain the same public API (exported functions, class methods, and their signatures)
2. THE refactored codebase SHALL pass all existing Vitest test suites without modification to test files, except for tests that directly reference `Conductor.getInstance()`
3. IF a refactoring changes internal method names or moves logic to a new module, THEN THE original module SHALL re-export or delegate to the new location to preserve the public interface
4. WHEN the Registry_Factory generates methods that replace hand-written methods, THE generated methods SHALL produce identical return values for the same inputs

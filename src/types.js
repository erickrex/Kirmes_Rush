/**
 * @fileoverview Common type definitions for Rythm Foundation Phaser JS
 * These JSDoc types provide type hints throughout the codebase.
 */

// ============================================================================
// TIMING TYPES
// ============================================================================

/**
 * Represents a BPM/time signature change in a song.
 * Supports both canonical field names (used by Conductor) and raw chart field names (used by ChartParser).
 * @typedef {Object} SongTimeChange
 * @property {number} [timeStamp] - Time in milliseconds when this change occurs (canonical)
 * @property {number} [t] - Time in milliseconds (raw chart format alias for timeStamp)
 * @property {number} bpm - Beats per minute at this point
 * @property {number} [beatTime] - Calculated beat time (set by Conductor)
 * @property {number} [timeSignatureNum] - Time signature numerator (canonical, default: 4)
 * @property {number} [timeSignatureDen] - Time signature denominator (canonical, default: 4)
 * @property {number} [n] - Time signature numerator (raw chart format alias)
 * @property {number} [d] - Time signature denominator (raw chart format alias)
 * @property {number} [b] - Beat count (raw chart format)
 * @property {number[]} [bt] - Beat tuplets (raw chart format)
 */

/**
 * Tallies for tracking player performance
 * @typedef {Object} Tallies
 * @property {number} sick - Count of sick judgements
 * @property {number} good - Count of good judgements
 * @property {number} bad - Count of bad judgements
 * @property {number} shit - Count of shit judgements
 * @property {number} missed - Count of missed notes
 * @property {number} combo - Current combo
 * @property {number} maxCombo - Maximum combo achieved
 * @property {number} totalNotesHit - Total notes successfully hit
 * @property {number} totalNotes - Total notes in the chart
 * @property {number} [score] - Accumulated score (used by GameplayState tallies)
 */

// ============================================================================
// RAW CHART/METADATA TYPES (as parsed from disk JSON)
// ============================================================================

/**
 * Raw note entry from chart JSON before mapping to canonical NoteData
 * @typedef {Object} RawChartNote
 * @property {number} t - Timestamp in milliseconds
 * @property {number} d - Data (lane index 0-7)
 * @property {number} [l=0] - Hold length in milliseconds
 * @property {string} [k] - Note kind
 */

/**
 * Raw chart JSON structure as read from disk
 * @typedef {Object} RawChartJSON
 * @property {string} version - Chart format version
 * @property {Object<string, number>} scrollSpeed - Scroll speed per difficulty
 * @property {Array<{t: number, e: string, v: *}>} events - Raw event entries
 * @property {Object<string, RawChartNote[]>} notes - Notes per difficulty
 * @property {string} [generatedBy] - Tool that generated the chart
 */

/**
 * Raw metadata JSON structure as read from disk
 * @typedef {Object} RawMetadataJSON
 * @property {string} version - Metadata format version
 * @property {string} songName - Display name of the song
 * @property {string} artist - Artist name
 * @property {Object} playData - Raw play data object
 * @property {Array<{t: number, bpm: number, n?: number, d?: number}>} timeChanges - BPM/time signature changes
 * @property {string} [charter] - Charter name
 * @property {string} [timeFormat] - Time format (ms, ticks, float)
 * @property {number} [divisions] - Divisions per beat
 * @property {boolean} [looped] - Whether the song loops
 * @property {string} [generatedBy] - Tool that generated the metadata
 */

// ============================================================================
// NOTE TYPES
// ============================================================================

/**
 * Canonical note data used throughout the application (direction-based).
 * This is the single authoritative NoteData definition — all modules should
 * import from types.js rather than defining their own.
 * @typedef {Object} NoteData
 * @property {number} time - Time in milliseconds when note should be hit
 * @property {number} direction - Note direction (0=left, 1=down, 2=up, 3=right)
 * @property {number} [data] - Raw lane index (0-7) from chart JSON before direction mapping
 * @property {number} length - Hold note duration in milliseconds (0 for tap notes)
 * @property {string} [kind] - Special note type (e.g., 'mine', 'hurt')
 * @property {number} [strumlineIndex] - Which strumline (0=opponent, 1=player)
 * @property {Array<{name: string, value: *}>} [params] - Additional note parameters
 */

/**
 * Note direction enum values
 * @typedef {0 | 1 | 2 | 3} NoteDirection
 */

/**
 * Judgement rating for a note hit
 * @typedef {'sick' | 'good' | 'bad' | 'shit' | 'miss'} Judgement
 */

/**
 * Scoring rank
 * @typedef {'PERFECT_GOLD' | 'PERFECT' | 'EXCELLENT' | 'GREAT' | 'GOOD' | 'SHIT'} ScoringRank
 */

// ============================================================================
// SONG/CHART TYPES
// ============================================================================

/**
 * Song metadata (simple form for UI consumption)
 * @typedef {Object} SongMetadata
 * @property {string} songName - Display name of the song
 * @property {string} artist - Artist name
 * @property {string} [charter] - Charter name
 * @property {string} [album] - Album ID for freeplay
 * @property {number} bpm - Starting BPM
 * @property {SongTimeChange[]} timeChanges - BPM/time signature changes
 * @property {string} [stage] - Stage ID
 * @property {SongCharacterData} [characters] - Character assignments
 * @property {string} [noteStyle] - Note style ID
 * @property {SongPlayData} [playData] - Gameplay data (stage, noteStyle, difficulties, characters)
 */

/**
 * Gameplay data embedded in song metadata
 * @typedef {Object} SongPlayData
 * @property {string} stage - Stage ID
 * @property {string} noteStyle - Note style ID
 * @property {string[]} difficulties - Available difficulties
 * @property {SongCharacterData} characters - Character data
 * @property {Object<string, number>} [ratings] - Difficulty ratings
 * @property {string} [album] - Album ID for freeplay
 * @property {number} [previewStart=0] - Preview start time in ms
 * @property {number} [previewEnd=15000] - Preview end time in ms
 */

/**
 * Character assignments for a song
 * @typedef {Object} SongCharacterData
 * @property {string} player - Player character ID
 * @property {string} opponent - Opponent character ID
 * @property {string} [girlfriend] - Girlfriend character ID
 * @property {string} [instrumental] - Instrumental variant
 * @property {string[]} [altInstrumentals] - Alternative instrumentals
 */

/**
 * Parsed song metadata with the richer ChartParser structure.
 * Includes all fields from the raw metadata JSON after parsing/validation.
 * @typedef {Object} ParsedSongMetadata
 * @property {string} version - Metadata version
 * @property {string} songName - Display name of the song
 * @property {string} artist - Artist name
 * @property {string} [charter] - Charter name
 * @property {string} [timeFormat='ms'] - Time format (ms, ticks, float)
 * @property {number} [divisions] - Divisions per beat
 * @property {boolean} [looped=false] - Whether the song loops
 * @property {SongPlayData} playData - Gameplay data
 * @property {SongTimeChange[]} timeChanges - BPM/time signature changes
 * @property {string} [generatedBy] - Tool that generated the chart
 * @property {string} [variation] - Variation ID
 */

/**
 * Chart data for a specific difficulty
 * @typedef {Object} ChartData
 * @property {string} version - Chart format version
 * @property {Object<string, number>} scrollSpeed - Per-difficulty scroll speed map
 * @property {Object<string, NoteData[]>} notes - Notes per difficulty (difficulty name → note array)
 * @property {SongEventData[]} events - Array of song events
 * @property {string} [generatedBy] - Tool that generated the chart
 * @property {string} [variation] - Variation ID
 */

/**
 * Song event data
 * @typedef {Object} SongEventData
 * @property {number} time - Time in milliseconds when event triggers
 * @property {string} event - Event type name
 * @property {Object} [value] - Event-specific parameters
 * @property {boolean} [activated] - Whether event has been triggered
 */

// ============================================================================
// INPUT TYPES
// ============================================================================

/**
 * Precise input event with timestamp
 * @typedef {Object} PreciseInputEvent
 * @property {NoteDirection} direction - Note direction pressed
 * @property {number} timestamp - High-precision timestamp (performance.now())
 * @property {string} [key] - Key code that triggered the input
 */

/**
 * Keybind configuration
 * @typedef {Object} Keybinds
 * @property {string[]} left - Keys bound to left direction
 * @property {string[]} down - Keys bound to down direction
 * @property {string[]} up - Keys bound to up direction
 * @property {string[]} right - Keys bound to right direction
 */

// ============================================================================
// SAVE DATA TYPES
// ============================================================================

/**
 * Score data for a song/difficulty
 * @typedef {Object} SaveScoreData
 * @property {number} score - High score
 * @property {ScoringRank} [rank] - Best rank achieved
 * @property {Tallies} [tallies] - Detailed tally data
 */

/**
 * User options/preferences
 * @typedef {Object} UserOptions
 * @property {number} globalOffset - Audio offset in milliseconds
 * @property {number} [audioVisualOffset] - Visual offset in milliseconds
 * @property {boolean} downscroll - Whether to use downscroll
 * @property {boolean} [ghostTapping] - Whether ghost tapping is enabled
 * @property {number} [masterVolume] - Master volume (0-1)
 * @property {number} [musicVolume] - Music volume (0-1)
 * @property {number} [sfxVolume] - SFX volume (0-1)
 * @property {Keybinds} [keybinds] - Custom keybinds
 */

/**
 * Complete save data structure
 * @typedef {Object} SaveData
 * @property {number} version - Save data version for migration
 * @property {Object<string, Object<string, SaveScoreData>>} scores - Scores by song ID and difficulty
 * @property {UserOptions} options - User preferences
 * @property {string[]} [unlockedContent] - IDs of unlocked content
 */

// ============================================================================
// REGISTRY TYPES
// ============================================================================

/**
 * Base registry entry interface
 * @typedef {Object} RegistryEntry
 * @property {string} id - Unique identifier
 * @property {function(): void} [destroy] - Cleanup function
 */

/**
 * Base registry entry interface (alias used by generic Registry<T> constraint).
 * Every registry entry must have at least an `id` and may provide a `destroy` hook.
 * @typedef {Object} RegistryEntryBase
 * @property {string} id - Unique identifier for the entry
 * @property {function(): void} [destroy] - Optional cleanup function
 */

/**
 * Configuration object for config-driven registries created via `createRegistry`.
 * @typedef {Object} RegistryConfig
 * @property {string} registryId - A readable ID for this registry, used when logging
 * @property {string} dataFilePath - The path (relative to assets/data) to search for JSON files
 * @property {string} [versionRule='1.0.x'] - The version rule for data validation
 * @property {string} [entityName] - Entity name used to generate helper methods (e.g. 'Character' → getCharacterData)
 * @property {string[]} [displayInfoFields] - Fields to include in display info lookups
 * @property {function(Object, string=): *} cleanData - Clean/normalize raw JSON data, returns cleaned data or null
 * @property {function(Object, string=): boolean} [validateData] - Optional extra validation before cleaning, return false to reject
 * @property {function(string, *): *} createEntry - Create an entry from id + cleaned data, return entry or null
 */

/**
 * Character data from registry
 * @typedef {Object} CharacterData
 * @property {string} id - Character ID
 * @property {string} name - Display name
 * @property {string} assetPath - Path to sprite assets
 * @property {Object<string, AnimationData>} animations - Animation definitions
 * @property {number[]} [healthIconOffset] - Health icon position offset
 * @property {number[]} [cameraOffset] - Camera focus offset
 * @property {boolean} [isPlayer] - Whether this is a player character
 * @property {number} [singDuration] - How long to hold sing animations (in steps)
 */

/**
 * Animation data for a character
 * @typedef {Object} AnimationData
 * @property {string} name - Animation name in spritesheet
 * @property {string} prefix - Frame prefix in atlas
 * @property {number[]} [offsets] - X, Y offset for this animation
 * @property {number} [frameRate] - Frames per second
 * @property {boolean} [looped] - Whether animation loops
 * @property {number[]} [frameIndices] - Specific frame indices to use
 */

/**
 * Stage data from registry
 * @typedef {Object} StageData
 * @property {string} id - Stage ID
 * @property {string} name - Display name
 * @property {number} camZoom - Default camera zoom
 * @property {StageProp[]} props - Stage props/layers
 * @property {Object<string, number[]>} [characterPositions] - Character positions by role
 * @property {Object<string, number[]>} [cameraPositions] - Camera positions by character
 */

/**
 * Stage prop/layer data
 * @typedef {Object} StageProp
 * @property {string} id - Prop ID
 * @property {string} assetPath - Path to image/spritesheet
 * @property {number[]} position - X, Y position
 * @property {number[]} [scroll] - Parallax scroll factor
 * @property {number} [zIndex] - Render order
 * @property {AnimationData[]} [animations] - Prop animations
 */

/**
 * Note style data from registry
 * @typedef {Object} NoteStyleData
 * @property {string} id - Note style ID
 * @property {string} name - Display name
 * @property {string} notesAsset - Path to notes spritesheet
 * @property {string} [splashAsset] - Path to note splash spritesheet
 * @property {number} [scale] - Scale multiplier
 * @property {boolean} [isPixel] - Whether this is a pixel art style
 */

// ============================================================================
// PLAYSTATE TYPES
// ============================================================================

/**
 * Parameters for initializing PlayState
 * @typedef {Object} PlayStateParams
 * @property {SongMetadata} song - Song to play
 * @property {string} [difficulty] - Difficulty to play (default: 'normal')
 * @property {string} [variation] - Song variation (default: 'default')
 * @property {string} [instrumental] - Instrumental track to use
 * @property {boolean} [practiceMode] - Whether practice mode is enabled
 * @property {boolean} [botPlayMode] - Whether bot play is enabled
 * @property {number} [startTimestamp] - Time to start at (for practice)
 * @property {number} [playbackRate] - Playback speed multiplier
 */

// ============================================================================
// EVENT TYPES
// ============================================================================

/**
 * Note hit event payload
 * @typedef {Object} NoteHitEvent
 * @property {NoteData} note - The note that was hit
 * @property {Judgement} judgement - Judgement received
 * @property {number} score - Score earned
 * @property {number} timing - Timing offset in ms (negative = early, positive = late)
 */

/**
 * Note miss event payload
 * @typedef {Object} NoteMissEvent
 * @property {NoteData} note - The note that was missed
 * @property {number} healthChange - Health penalty applied
 */

// ============================================================================
// SCENE PAYLOAD TYPES
// ============================================================================

/**
 * Data payload passed to PlayScene via `scene.start('PlayState', data)`.
 * @typedef {Object} PlayScenePayload
 * @property {PreparedPlaySession} [session] - Fully prepared play session from LoadingState
 * @property {object} [chart] - Chart data (legacy direct-launch path)
 * @property {object} [songData] - Song data (legacy direct-launch path)
 * @property {object} [song] - Song data (alternate key, legacy)
 * @property {string} [difficulty] - Difficulty to play
 * @property {string} [replayId] - Replay ID for replay playback mode
 * @property {boolean} [isReplay] - Whether this is a replay playback
 */

/**
 * Data payload passed to LoadingState via `scene.start('LoadingState', config)`.
 * @typedef {Object} LoadingStatePayload
 * @property {string} nextScene - Scene to transition to after loading
 * @property {Object} [nextSceneData] - Data to pass to next scene
 * @property {string[]} [assets] - Assets to load
 * @property {Function} [loadCallback] - Custom loading callback
 * @property {Function} [prepareCallback] - Async preparation callback returning { assets, nextSceneData }
 * @property {string} [message] - Loading message to display
 * @property {number} [minDuration=500] - Minimum display time in ms
 */

/**
 * Data payload passed to ResultState via `scene.start('ResultState', data)`.
 * @typedef {Object} ResultStatePayload
 * @property {number} [score] - Final score
 * @property {Tallies} [tallies] - Score tallies breakdown
 * @property {string} [rank] - Calculated rank
 * @property {ResultSongData | null} [songData] - Song context for return navigation
 * @property {object | null} [timingStats] - Timing analysis from InputStatistics
 * @property {boolean} [newHighScore] - Whether this run set a new local best
 * @property {number} [accuracy] - Accuracy percentage
 */

/**
 * Song data embedded in ResultState payload for return navigation.
 * @typedef {Object} ResultSongData
 * @property {string} [songName] - Display name of the song
 * @property {string} [difficulty] - Difficulty played
 * @property {string} [returnScene] - Scene to return to after results
 * @property {object} [returnSceneData] - Data to pass to the return scene
 */

// ============================================================================
// PREPARED PLAY SESSION TYPES
// ============================================================================

/**
 * A fully prepared play session object passed through LoadingState to PlayScene.
 * Contains all resolved data needed to start gameplay.
 * @typedef {Object} PreparedPlaySession
 * @property {Object | null} level - Level configuration (features, UI toggles)
 * @property {string} difficulty - Difficulty to play (e.g. 'normal', 'hard')
 * @property {Object | null} chart - Parsed chart data
 * @property {Object | null} songData - Song metadata (id, stage, characters, noteStyle, returnScene)
 * @property {Object | null} audio - Audio references (instrumental key, voice keys)
 * @property {Object[]} assets - Asset descriptors to preload
 * @property {Object | null} metadata - Raw metadata (playData, timeChanges)
 */

// ============================================================================
// REPLAY TYPES
// ============================================================================

/**
 * A single recorded input event within a replay.
 * @typedef {Object} ReplayFrame
 * @property {number} time - Time in ms from song start
 * @property {'press' | 'release'} type - Input event type
 * @property {number} direction - Note direction (0-3)
 * @property {string} keyCode - Key code that triggered the input
 */

/**
 * Complete replay data structure for recording and playback.
 * @typedef {Object} ReplayData
 * @property {string} version - Replay format version
 * @property {string} songId - Song identifier
 * @property {string} difficulty - Difficulty level
 * @property {number} timestamp - Recording timestamp (Date.now())
 * @property {number} score - Final score
 * @property {Object} tallies - Final tallies
 * @property {number} seed - Random seed for determinism
 * @property {ReplayFrame[]} inputs - Recorded input frames
 * @property {Object} metadata - Additional metadata (gameVersion, accuracy)
 */

// ============================================================================
// AUDIO BOUNDARY TYPES
// ============================================================================

/**
 * Typed wrapper for the Web Audio context obtained from Phaser's sound manager.
 * Used at Phaser boundary call sites to avoid propagating `any` into application code.
 * @typedef {Object} PhaserWebAudioContext
 * @property {string} state - AudioContext state ('suspended' | 'running' | 'closed')
 * @property {function(): Promise<void>} resume - Resume the audio context
 * @property {function(): Promise<void>} close - Close the audio context
 * @property {number} currentTime - Current audio context time in seconds
 * @property {number} sampleRate - Sample rate in Hz
 */

/**
 * Typed interface for Phaser.Sound.WebAudioSoundManager boundary access.
 * @typedef {Object} PhaserWebAudioSoundManager
 * @property {PhaserWebAudioContext} context - The underlying Web Audio context
 * @property {function(string, object=): Phaser.Sound.BaseSound} add - Add a sound
 * @property {function(): void} stopAll - Stop all sounds
 * @property {boolean} mute - Global mute flag
 * @property {number} volume - Global volume
 */

/**
 * Typed interface for Phaser.Sound.HTML5AudioSoundManager boundary access.
 * @typedef {Object} PhaserHTML5AudioSoundManager
 * @property {function(string, object=): Phaser.Sound.BaseSound} add - Add a sound
 * @property {function(): void} stopAll - Stop all sounds
 * @property {boolean} mute - Global mute flag
 * @property {number} volume - Global volume
 */

// Export empty object to make this a module
export {};

/**
 * @fileoverview Common type definitions for Friday Night Funkin' Phaser JS
 * These JSDoc types provide type hints throughout the codebase.
 */

// ============================================================================
// TIMING TYPES
// ============================================================================

/**
 * Represents a BPM/time signature change in a song
 * @typedef {Object} SongTimeChange
 * @property {number} timeStamp - Time in milliseconds when this change occurs
 * @property {number} bpm - Beats per minute at this point
 * @property {number} [beatTime] - Calculated beat time (set by Conductor)
 * @property {number} [timeSignatureNum] - Time signature numerator (default: 4)
 * @property {number} [timeSignatureDen] - Time signature denominator (default: 4)
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
 */

// ============================================================================
// NOTE TYPES
// ============================================================================

/**
 * Raw note data from chart JSON
 * @typedef {Object} NoteData
 * @property {number} time - Time in milliseconds when note should be hit
 * @property {number} direction - Note direction (0=left, 1=down, 2=up, 3=right)
 * @property {number} length - Hold note duration in milliseconds (0 for tap notes)
 * @property {string} [kind] - Special note type (e.g., 'mine', 'hurt')
 * @property {number} [strumlineIndex] - Which strumline (0=opponent, 1=player)
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
 * Song metadata
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
 */

/**
 * Character assignments for a song
 * @typedef {Object} SongCharacterData
 * @property {string} player - Player character ID
 * @property {string} opponent - Opponent character ID
 * @property {string} [girlfriend] - Girlfriend character ID
 */

/**
 * Chart data for a specific difficulty
 * @typedef {Object} ChartData
 * @property {string} version - Chart format version
 * @property {number} scrollSpeed - Note scroll speed multiplier
 * @property {NoteData[]} notes - Array of note data
 * @property {SongEventData[]} events - Array of song events
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

// Export empty object to make this a module
export {};

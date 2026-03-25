/**
 * A store of unchanging, globally relevant values.
 * Ported from source/funkin/util/Constants.hx
 */

// ==============================
// ENGINE AND VERSION DATA
// ==============================

/** The title of the game, for debug printing purposes. */
export const TITLE = "Friday Night Funkin'";

/** The current version number of the game. */
export const VERSION = 'v0.1.0';

/** A suffix to add to the game version. */
export const VERSION_SUFFIX = '';

/** Whether or not the game is a debug build. */
export const DEBUG_BUILD = false;

/** The generatedBy string embedded in chart files. */
export const GENERATED_BY = `${TITLE} - ${VERSION}`;

// ==============================
// URL DATA
// ==============================

/** Link to buy merch for the game. */
export const URL_MERCH_FALLBACK = 'https://needlejuicerecords.com/en-ca/pages/friday-night-funkin';

/** Link to download the game on Itch.io. */
export const URL_ITCH = 'https://ninja-muffin24.itch.io/funkin';

/** Link to play the game on Newgrounds. */
export const URL_NEWGROUNDS = 'https://www.newgrounds.com/portal/view/770371';

/** Link to the game's page on Kickstarter. */
export const URL_KICKSTARTER =
  'https://www.kickstarter.com/projects/funkin/friday-night-funkin-the-full-ass-game/';

// ==============================
// COLORS
// ==============================

/** The color used by the enemy health bar. */
export const COLOR_HEALTH_BAR_RED = 0xff0000;

/** The color used by the player health bar. */
export const COLOR_HEALTH_BAR_GREEN = 0x66ff33;

/** The base colors used by notes (left, down, up, right). */
export const COLOR_NOTES = [
  0xff22aa, // left (0)
  0x00eeff, // down (1)
  0x00cc00, // up (2)
  0xcc1111 // right (3)
];

/** Color for the preloader background. */
export const COLOR_PRELOADER_BG = 0x000000;

/** Color for the preloader progress bar. */
export const COLOR_PRELOADER_BAR = 0xa4ff11;

/** Color for the preloader site lock background. */
export const COLOR_PRELOADER_LOCK_BG = 0x1b1717;

/** Color for the preloader site lock foreground. */
export const COLOR_PRELOADER_LOCK_FG = 0xb96f10;

/** Color for the preloader site lock text. */
export const COLOR_PRELOADER_LOCK_FONT = 0xcccccc;

/** Color for the preloader site lock link. */
export const COLOR_PRELOADER_LOCK_LINK = 0xeeb211;

// ==============================
// GAME DEFAULTS
// ==============================

/** Default difficulty for charts. */
export const DEFAULT_DIFFICULTY = 'normal';

/** Default list of difficulties for charts. */
export const DEFAULT_DIFFICULTY_LIST = ['easy', 'normal', 'hard'];

/** Default list of difficulties for Erect mode. */
export const DEFAULT_DIFFICULTY_LIST_ERECT = ['erect', 'nightmare'];

/** List of all difficulties used by the base game. */
export const DEFAULT_DIFFICULTY_LIST_FULL = ['easy', 'normal', 'hard', 'erect', 'nightmare'];

/** Default player character for charts. */
export const DEFAULT_CHARACTER = 'bf';

/** Default player character for health icons. */
export const DEFAULT_HEALTH_ICON = 'face';

/** Default stage for charts. */
export const DEFAULT_STAGE = 'mainStage';

/** Default song for if the PlayState messes up. */
export const DEFAULT_SONG = 'tutorial';

/** Default variation for charts. */
export const DEFAULT_VARIATION = 'default';

/** Standardized variations for charts. */
export const DEFAULT_VARIATION_LIST = ['default', 'erect', 'pico', 'bf'];

/** Default sticker pack for transitions. */
export const DEFAULT_STICKER_PACK = 'default';

/** The default intensity multiplier for camera bops. */
export const DEFAULT_BOP_INTENSITY = 1.015;

/** The default rate for camera zooms (in beats per zoom). */
export const DEFAULT_ZOOM_RATE = 4;

/** The default offset of camera zooms (in beats). */
export const DEFAULT_ZOOM_OFFSET = 0;

/** The default BPM for charts. */
export const DEFAULT_BPM = 100.0;

/** The default name for songs. */
export const DEFAULT_SONGNAME = 'Unknown';

/** The default artist for songs. */
export const DEFAULT_ARTIST = 'Unknown';

/** The default charter for songs. */
export const DEFAULT_CHARTER = 'Unknown';

/** The default note style for songs. */
export const DEFAULT_NOTE_STYLE = 'funkin';

/** The default freeplay style for characters. */
export const DEFAULT_FREEPLAY_STYLE = 'bf';

/** The default pixel note style for songs. */
export const DEFAULT_PIXEL_NOTE_STYLE = 'pixel';

/** The default album for songs in Freeplay. */
export const DEFAULT_ALBUM_ID = 'volume1';

/** The default timing format for songs. */
export const DEFAULT_TIMEFORMAT = 'ms';

/** The default scroll speed for songs. */
export const DEFAULT_SCROLLSPEED = 1.0;

/** The default number of steps to hold a singing animation. */
export const DEFAULT_SING_TIME = 8.0;

/** Default numerator for the time signature. */
export const DEFAULT_TIME_SIGNATURE_NUM = 4;

/** Default denominator for the time signature. */
export const DEFAULT_TIME_SIGNATURE_DEN = 4;

// ==============================
// ANIMATIONS
// ==============================

/** A suffix used for animations played when an animation would loop. */
export const ANIMATION_HOLD_SUFFIX = '-hold';

/** A suffix used for animations played when an animation would end before transitioning to another. */
export const ANIMATION_END_SUFFIX = '-end';

// ==============================
// TIMING
// ==============================

/** A magic number used when calculating scroll speed and note distances. */
export const PIXELS_PER_MS = 0.45;

/** The maximum interval within which a note can be hit, in milliseconds. */
export const HIT_WINDOW_MS = 160.0;

/** Constant for the number of seconds in a minute. */
export const SECS_PER_MIN = 60;

/** Constant for the number of milliseconds in a second. */
export const MS_PER_SEC = 1000;

/** The number of microseconds in a millisecond. */
export const US_PER_MS = 1000;

/** The number of microseconds in a second. */
export const US_PER_SEC = US_PER_MS * MS_PER_SEC;

/** The number of nanoseconds in a microsecond. */
export const NS_PER_US = 1000;

/** The number of nanoseconds in a millisecond. */
export const NS_PER_MS = NS_PER_US * US_PER_MS;

/** The number of nanoseconds in a second. */
export const NS_PER_SEC = NS_PER_US * US_PER_MS * MS_PER_SEC;

/** Duration, in milliseconds, until toast notifications are automatically hidden. */
export const NOTIFICATION_DISMISS_TIME = 5 * MS_PER_SEC;

/** Duration to wait before autosaving the chart (in seconds). */
export const AUTOSAVE_TIMER_DELAY_SEC = 5.0 * SECS_PER_MIN;

/** Number of steps in a beat. One step is one 16th note and one beat is one quarter note. */
export const STEPS_PER_BEAT = 4;

/**
 * All MP3 decoders introduce a playback delay of 528 samples,
 * which at 44,100 Hz (samples per second) is ~12 ms.
 */
export const MP3_DELAY_MS = (528 / 44100) * MS_PER_SEC;

/** Each step of the preloader has to be on screen at least this long. */
export const PRELOADER_MIN_STAGE_TIME = 0.1;

/** Time (in seconds) to wait on the Title Screen before entering the Attract State. */
export const TITLE_ATTRACT_DELAY = 37.5;

// ==============================
// HEALTH VALUES
// ==============================

/** The player's maximum health. */
export const HEALTH_MAX = 2.0;

/** The player's starting health. */
export const HEALTH_STARTING = HEALTH_MAX / 2.0;

/** The player's minimum health. If at or below this value, they lose. */
export const HEALTH_MIN = 0.0;

/** The amount of health the player gains when hitting a note with the KILLER rating. */
export const HEALTH_KILLER_BONUS = (2.0 / 100.0) * HEALTH_MAX; // +2.0%

/** The amount of health the player gains when hitting a note with the SICK rating. */
export const HEALTH_SICK_BONUS = (1.5 / 100.0) * HEALTH_MAX; // +1.5%

/** The amount of health the player gains when hitting a note with the GOOD rating. */
export const HEALTH_GOOD_BONUS = (0.75 / 100.0) * HEALTH_MAX; // +0.75%

/** The amount of health the player gains when hitting a note with the BAD rating. */
export const HEALTH_BAD_BONUS = (0.0 / 100.0) * HEALTH_MAX; // +0.0%

/** The amount of health the player gains when hitting a note with the SHIT rating. */
export const HEALTH_SHIT_BONUS = (-1.0 / 100.0) * HEALTH_MAX; // -1.0%

/** The amount of health the player gains, while holding a hold note, per second. */
export const HEALTH_HOLD_BONUS_PER_SECOND = (6.0 / 100.0) * HEALTH_MAX; // +6.0% / second

/** The amount of health the player loses upon missing a note. */
export const HEALTH_MISS_PENALTY = (-4.0 / 100.0) * HEALTH_MAX; // -4.0%

/** The amount of health the player loses upon pressing a key when no note is there. */
export const HEALTH_GHOST_MISS_PENALTY = (-4.0 / 100.0) * HEALTH_MAX; // -4.0%

/** The amount of health the player loses upon letting go of a hold note, per second remaining. */
export const HEALTH_HOLD_DROP_PENALTY_PER_SECOND = (0 / 100.0) * HEALTH_MAX; // 0%

/** The maximum amount of health the player can lose upon letting go of a hold note. */
export const HEALTH_HOLD_DROP_PENALTY_MAX = (0 / 100.0) * HEALTH_MAX; // 0%

/** The amount of health the player loses upon hitting a mine. */
export const HEALTH_MINE_PENALTY = (-15.0 / 100.0) * HEALTH_MAX; // -15.0%

// ==============================
// SCORE VALUES
// ==============================

/** The amount of score the player gains for every second they hold a hold note. */
export const SCORE_HOLD_BONUS_PER_SECOND = 250.0;

/** The amount of score the player loses upon letting go of a hold note, per second remaining. */
export const SCORE_HOLD_DROP_PENALTY_PER_SECOND = -125.0;

/** The minimum amount of the hold note, in milliseconds, before the player gets penalized for letting go early. */
export const HOLD_DROP_PENALTY_THRESHOLD_MS = 160.0;

/** Whether hitting a KILLER note breaks combo. */
export const JUDGEMENT_KILLER_COMBO_BREAK = false;

/** Whether hitting a SICK note breaks combo. */
export const JUDGEMENT_SICK_COMBO_BREAK = false;

/** Whether hitting a GOOD note breaks combo. */
export const JUDGEMENT_GOOD_COMBO_BREAK = false;

/** Whether hitting a BAD note breaks combo. */
export const JUDGEMENT_BAD_COMBO_BREAK = true;

/** Whether hitting a SHIT note breaks combo. */
export const JUDGEMENT_SHIT_COMBO_BREAK = true;

// ==============================
// RANK THRESHOLDS
// ==============================

/** Completion threshold for PERFECT rank. */
export const RANK_PERFECT_THRESHOLD = 1.0;

/** Completion threshold for EXCELLENT rank. */
export const RANK_EXCELLENT_THRESHOLD = 0.9;

/** Completion threshold for GREAT rank. */
export const RANK_GREAT_THRESHOLD = 0.8;

/** Completion threshold for GOOD rank. */
export const RANK_GOOD_THRESHOLD = 0.6;

// ==============================
// FILE EXTENSIONS
// ==============================

/** The file extension used when exporting chart files. */
export const EXT_CHART = 'fnfc';

/** The file extension used when exporting stage files. */
export const EXT_STAGE = 'fnfs';

/** The file extension used when loading audio files (web uses mp3). */
export const EXT_SOUND = 'mp3';

/** The file extension used when loading video files. */
export const EXT_VIDEO = 'mp4';

/** The file extension used when loading image files. */
export const EXT_IMAGE = 'png';

/** The file extension used when loading data files. */
export const EXT_DATA = 'json';

// ==============================
// OTHER
// ==============================

/** Duration, in seconds, after the player's section ends before the player can spam without penalty. */
export const GHOST_TAP_DELAY = 3 / 8;

/** Whether to censor expletives. */
export const CENSOR_EXPLETIVES = false;

/** The maximum number of previous file paths for the Chart Editor to remember. */
export const MAX_PREVIOUS_WORKING_FILES = 10;

/** The separator between an asset library and the asset path. */
export const LIBRARY_SEPARATOR = ':';

/** The scale factor to use when increasing the size of pixel art graphics. */
export const PIXEL_ART_SCALE = 6;

/** The volume at which to play the countdown before the song starts. */
export const COUNTDOWN_VOLUME = 0.6;

/** The horizontal offset of the strumline from the left edge of the screen. */
export const STRUMLINE_X_OFFSET = 48;

/** The vertical offset of the strumline from the top edge of the screen. */
export const STRUMLINE_Y_OFFSET = 24;

/** The rate at which the camera lerps to its target. 0.04 = 4% of distance per frame. */
export const DEFAULT_CAMERA_FOLLOW_RATE = 0.04;

/** Default period value for vibration. */
export const DEFAULT_VIBRATION_PERIOD = 0.1;

/** Default duration value for vibration. */
export const DEFAULT_VIBRATION_DURATION = 0.1;

/** Min vibration amplitude. */
export const MIN_VIBRATION_AMPLITUDE = 0.25;

/** Default vibration amplitude. */
export const DEFAULT_VIBRATION_AMPLITUDE = 0.5;

/** Max vibration amplitude. */
export const MAX_VIBRATION_AMPLITUDE = 1;

/** Default vibration sharpness. */
export const DEFAULT_VIBRATION_SHARPNESS = 1;

// ==============================
// SCORING SYSTEM CONSTANTS (PBOT1)
// ==============================

/** The maximum score a note can receive. */
export const PBOT1_MAX_SCORE = 500;

/** The offset of the sigmoid curve for the scoring function. */
export const PBOT1_SCORING_OFFSET = 54.99;

/** The slope of the sigmoid curve for the scoring function. */
export const PBOT1_SCORING_SLOPE = 0.08;

/** The minimum score a note can receive while still being considered a hit. */
export const PBOT1_MIN_SCORE = 9.0;

/** The score a note receives when it is missed. */
export const PBOT1_MISS_SCORE = -100;

/** The threshold at which a note hit is considered perfect and always given the max score. */
export const PBOT1_PERFECT_THRESHOLD = 5.0; // 5ms

/** The threshold at which a note hit is considered missed. */
export const PBOT1_MISS_THRESHOLD = 160.0; // 160ms

/** The time within which a note is considered to have been hit with the Killer judgement. */
export const PBOT1_KILLER_THRESHOLD = 12.5; // ~7.5% of the hit window

/** The time within which a note is considered to have been hit with the Sick judgement. */
export const PBOT1_SICK_THRESHOLD = 45.0; // ~25% of the hit window

/** The time within which a note is considered to have been hit with the Good judgement. */
export const PBOT1_GOOD_THRESHOLD = 90.0; // ~55% of the hit window

/** The time within which a note is considered to have been hit with the Bad judgement. */
export const PBOT1_BAD_THRESHOLD = 135.0; // ~85% of the hit window

/** The time within which a note is considered to have been hit with the Shit judgement. */
export const PBOT1_SHIT_THRESHOLD = 160.0; // 100% of the hit window

// ==============================
// SCORING SYSTEM CONSTANTS (LEGACY)
// ==============================

/**
 * The window of time in which a note is considered to be hit, on the Funkin Legacy scoring system.
 * Currently equal to 10 frames at 60fps, or ~166ms.
 */
export const LEGACY_HIT_WINDOW = (10 / 60) * 1000; // 166.67 ms hit window (10 frames at 60fps)

/**
 * The threshold at which a note is considered a "Sick" hit rather than another judgement.
 * Represented as a percentage of the total hit window.
 */
export const LEGACY_SICK_THRESHOLD = 0.2; // 20% of hit window

/**
 * The threshold at which a note is considered a "Good" hit rather than another judgement.
 * Represented as a percentage of the total hit window.
 */
export const LEGACY_GOOD_THRESHOLD = 0.75; // 75% of hit window

/**
 * The threshold at which a note is considered a "Bad" hit rather than another judgement.
 * Represented as a percentage of the total hit window.
 */
export const LEGACY_BAD_THRESHOLD = 0.9; // 90% of hit window

/**
 * The threshold at which a note is considered a "Shit" hit rather than a miss.
 * Represented as a percentage of the total hit window.
 */
export const LEGACY_SHIT_THRESHOLD = 1.0; // 100% of hit window

/** The score a note receives when hit within the Sick threshold. */
export const LEGACY_SICK_SCORE = 350;

/** The score a note receives when hit within the Good threshold. */
export const LEGACY_GOOD_SCORE = 200;

/** The score a note receives when hit within the Bad threshold. */
export const LEGACY_BAD_SCORE = 100;

/** The score a note receives when hit within the Shit threshold. */
export const LEGACY_SHIT_SCORE = 50;

/** The score a note receives when missed. */
export const LEGACY_MISS_SCORE = -10;

// ==============================
// SCORING SYSTEM CONSTANTS (WEEK7)
// ==============================

/**
 * The window of time in which a note is considered to be hit, on the Week 7 scoring system.
 * Same as Legacy: 10 frames at 60fps, or ~166ms.
 */
export const WEEK7_HIT_WINDOW = LEGACY_HIT_WINDOW;

/**
 * The threshold at which a note is considered a "Sick" hit in Week 7.
 * Represented as a percentage of the total hit window.
 */
export const WEEK7_SICK_THRESHOLD = 0.2; // 20% of the hit window, or ~33ms

/**
 * The threshold at which a note is considered a "Good" hit in Week 7.
 * Represented as a percentage of the total hit window.
 */
export const WEEK7_GOOD_THRESHOLD = 0.55; // 55% of the hit window, or ~91ms

/**
 * The threshold at which a note is considered a "Bad" hit in Week 7.
 * Represented as a percentage of the total hit window.
 */
export const WEEK7_BAD_THRESHOLD = 0.8; // 80% of the hit window, or ~125ms

/** The score a note receives when hit within the Sick threshold in Week 7. */
export const WEEK7_SICK_SCORE = 350;

/** The score a note receives when hit within the Good threshold in Week 7. */
export const WEEK7_GOOD_SCORE = 200;

/** The score a note receives when hit within the Bad threshold in Week 7. */
export const WEEK7_BAD_SCORE = 100;

/** The score a note receives when hit within the Shit threshold in Week 7. */
export const WEEK7_SHIT_SCORE = 50;

/** The score a note receives when missed in Week 7. */
export const WEEK7_MISS_SCORE = -10;

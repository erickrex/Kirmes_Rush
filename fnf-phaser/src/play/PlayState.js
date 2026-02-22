/**
 * @fileoverview PlayState - Main gameplay scene
 * Handles note generation, input processing, miss detection, and countdown.
 * Integrates characters, stage, and camera for full gameplay.
 *
 * Ported from source/funkin/play/PlayState.hx
 */

import * as Constants from '../core/Constants.js';
import Conductor from '../core/Conductor.js';
import EventBus, { Events } from '../core/EventBus.js';
import Scoring from './Scoring.js';
import Strumline from './Strumline.js';
import Character from './Character.js';
import Stage from './Stage.js';
import FunkinCamera from '../graphics/FunkinCamera.js';
import SaveManager from '../data/SaveManager.js';
import { ReplayRecorder, ReplayPlayer } from '../replay/ReplaySystem.js';
import { InputBuffer } from '../input/InputSystem.js';
import LevelSystem from '../levels/LevelSystem.js';

/**
 * @typedef {Object} PlayStateConfig
 * @property {Object} song - Song data
 * @property {string} [difficulty='normal'] - Difficulty level
 * @property {number} [startTimestamp=0] - Start time in ms
 * @property {Object} [chart=null] - Parsed chart data
 */

/**
 * @typedef {Object} Tallies
 * @property {number} sick - Sick hits
 * @property {number} good - Good hits
 * @property {number} bad - Bad hits
 * @property {number} shit - Shit hits
 * @property {number} missed - Missed notes
 * @property {number} combo - Current combo
 * @property {number} maxCombo - Maximum combo achieved
 * @property {number} totalNotesHit - Total notes hit
 * @property {number} totalNotes - Total notes in chart
 */

/**
 * Main gameplay scene for Friday Night Funkin'.
 */
class PlayState {
  /**
   * The Phaser scene
   * @type {Phaser.Scene | null}
   */
  scene = null;

  /**
   * Song data
   * @type {Object | null}
   */
  songData = null;

  /**
   * Current difficulty
   * @type {string}
   */
  difficulty = Constants.DEFAULT_DIFFICULTY;

  /**
   * Start timestamp
   * @type {number}
   */
  startTimestamp = 0;

  /**
   * Parsed chart data
   * @type {Object | null}
   */
  chart = null;

  // ========================================
  // GAMEPLAY STATE
  // ========================================

  /**
   * Current health (0-2)
   * @type {number}
   */
  health = Constants.HEALTH_STARTING;

  /**
   * Current score
   * @type {number}
   */
  score = 0;

  /**
   * Current combo
   * @type {number}
   */
  combo = 0;

  /**
   * Maximum combo achieved
   * @type {number}
   */
  maxCombo = 0;

  /**
   * Score tallies
   * @type {Tallies}
   */
  tallies = {
    sick: 0,
    good: 0,
    bad: 0,
    shit: 0,
    missed: 0,
    combo: 0,
    maxCombo: 0,
    totalNotesHit: 0,
    totalNotes: 0
  };

  // ========================================
  // TIMING
  // ========================================

  /**
   * Conductor instance
   * @type {Conductor | null}
   */
  conductor = null;

  /**
   * Current song position in ms
   * @type {number}
   */
  songPosition = 0;

  /**
   * Song length in ms
   * @type {number}
   */
  songLength = 0;

  /**
   * Whether the song has started
   * @type {boolean}
   */
  songStarted = false;

  /**
   * Whether the countdown is active
   * @type {boolean}
   */
  countdownActive = false;

  /**
   * Current countdown step
   * @type {number}
   */
  countdownStep = 0;

  // ========================================
  // STRUMLINES
  // ========================================

  /**
   * Player strumline
   * @type {Strumline | null}
   */
  playerStrumline = null;

  /**
   * Opponent strumline
   * @type {Strumline | null}
   */
  opponentStrumline = null;

  // ========================================
  // INPUT
  // ========================================

  /**
   * Input press queue
   * @type {Array<{direction: number, timestamp: number}>}
   */
  inputPressQueue = [];

  /**
   * Input release queue
   * @type {Array<{direction: number, timestamp: number}>}
   */
  inputReleaseQueue = [];

  /**
   * PreciseInput instance
   * @type {Object | null}
   */
  preciseInput = null;

  // ========================================
  // REPLAY RECORDING
  // ========================================

  /**
   * ReplayRecorder instance for recording gameplay
   * @type {ReplayRecorder | null}
   */
  replayRecorder = null;

  /**
   * Whether replay recording is enabled
   * @type {boolean}
   */
  replayRecordingEnabled = false;

  // ========================================
  // REPLAY PLAYBACK
  // ========================================

  /**
   * ReplayPlayer instance for replay playback
   * @type {ReplayPlayer | null}
   */
  replayPlayer = null;

  /**
   * Whether currently in replay mode
   * @type {boolean}
   */
  replayMode = false;

  /**
   * Replay indicator text object
   * @type {Object | null}
   */
  replayIndicator = null;

  // ========================================
  // LEVEL SYSTEM
  // ========================================

  /**
   * LevelSystem instance for feature toggles
   * @type {LevelSystem | null}
   */
  levelSystem = null;

  // ========================================
  // INPUT BUFFER
  // ========================================

  /**
   * InputBuffer instance for buffered input handling
   * @type {InputBuffer | null}
   */
  inputBuffer = null;

  /**
   * Whether input buffer is enabled
   * @type {boolean}
   */
  inputBufferEnabled = false;

  // ========================================
  // AUDIO
  // ========================================

  /**
   * AudioManager instance
   * @type {Object | null}
   */
  audioManager = null;

  /**
   * VoicesGroup instance
   * @type {Object | null}
   */
  voices = null;

  // ========================================
  // CAMERAS
  // ========================================

  /**
   * Main game camera
   * @type {Object | null}
   */
  camGame = null;

  /**
   * HUD camera
   * @type {Object | null}
   */
  camHUD = null;

  /**
   * FunkinCamera controller
   * @type {FunkinCamera | null}
   */
  funkinCamera = null;

  // ========================================
  // CHARACTERS (Task 4.3)
  // ========================================

  /**
   * Player character (boyfriend)
   * @type {Character | null}
   */
  player = null;

  /**
   * Opponent character (dad)
   * @type {Character | null}
   */
  opponent = null;

  /**
   * Girlfriend character
   * @type {Character | null}
   */
  girlfriend = null;

  /**
   * Current camera focus target (0 = opponent, 1 = player)
   * @type {number}
   */
  cameraFocusTarget = 0;

  // ========================================
  // STAGE
  // ========================================

  /**
   * Stage instance
   * @type {Stage | null}
   */
  stage = null;

  // ========================================
  // CALLBACKS
  // ========================================

  /**
   * Callback when note is hit
   * @type {Function | null}
   */
  onNoteHit = null;

  /**
   * Callback when note is missed
   * @type {Function | null}
   */
  onNoteMiss = null;

  /**
   * Callback when song ends
   * @type {Function | null}
   */
  onSongEnd = null;

  /**
   * Callback when countdown step occurs
   * @type {Function | null}
   */
  onCountdownStep = null;

  /**
   * Create a new PlayState
   * @param {Phaser.Scene} scene - The Phaser scene
   */
  constructor(scene) {
    this.scene = scene;
    this.conductor = Conductor.getInstance();
  }

  // ========================================
  // INITIALIZATION
  // ========================================

  /**
   * Initialize the play state with song data
   * @param {PlayStateConfig} config - Configuration
   */
  init(config) {
    this.songData = config.song ?? null;
    this.difficulty = config.difficulty ?? Constants.DEFAULT_DIFFICULTY;
    this.startTimestamp = config.startTimestamp ?? 0;
    this.chart = config.chart ?? null;

    // Reset state
    this.resetState();

    // Setup conductor
    if (this.chart?.timeChanges) {
      this.conductor.mapTimeChanges(this.chart.timeChanges);
    }

    // Calculate song length
    if (this.chart?.notes) {
      const allNotes = [...(this.chart.notes.player ?? []), ...(this.chart.notes.opponent ?? [])];
      if (allNotes.length > 0) {
        const lastNote = allNotes.reduce((a, b) => (a.time > b.time ? a : b));
        this.songLength = lastNote.time + (lastNote.length ?? 0) + 1000;
      }
    }

    // Count total notes
    if (this.chart?.notes?.player) {
      this.tallies.totalNotes = this.chart.notes.player.length;
    }
  }

  /**
   * Reset gameplay state
   */
  resetState() {
    this.health = Constants.HEALTH_STARTING;
    this.score = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.songPosition = 0;
    this.songStarted = false;
    this.countdownActive = false;
    this.countdownStep = 0;

    this.tallies = {
      sick: 0,
      good: 0,
      bad: 0,
      shit: 0,
      missed: 0,
      combo: 0,
      maxCombo: 0,
      totalNotesHit: 0,
      totalNotes: 0
    };

    this.inputPressQueue = [];
    this.inputReleaseQueue = [];
  }

  // ========================================
  // SETUP
  // ========================================

  /**
   * Create strumlines
   * @param {Object} [noteStyle=null] - Note style to use
   * @param {number} [scrollSpeed=1.0] - Scroll speed
   */
  createStrumlines(noteStyle = null, scrollSpeed = 1.0) {
    // Player strumline (right side)
    this.playerStrumline = new Strumline(this.scene, true, noteStyle, scrollSpeed);
    this.playerStrumline.setPosition(Constants.STRUMLINE_X_OFFSET + 560, Constants.STRUMLINE_Y_OFFSET);

    // Opponent strumline (left side)
    this.opponentStrumline = new Strumline(this.scene, false, noteStyle, scrollSpeed);
    this.opponentStrumline.setPosition(Constants.STRUMLINE_X_OFFSET, Constants.STRUMLINE_Y_OFFSET);
  }

  /**
   * Setup cameras
   */
  setupCameras() {
    if (!this.scene?.cameras) return;

    this.camGame = this.scene.cameras.main;

    // Create HUD camera
    this.camHUD = this.scene.cameras.add(0, 0, this.scene.scale?.width ?? 1280, this.scene.scale?.height ?? 720);
    this.camHUD.setScroll(0, 0);

    // Create FunkinCamera controller only if camera effects are enabled
    if (this.isFeatureEnabled('cameraEffects')) {
      this.funkinCamera = new FunkinCamera(this.scene, this.camGame);
    }
  }

  // ========================================
  // STAGE SETUP (Task 4.3)
  // ========================================

  /**
   * Create and setup the stage
   * @param {string} [stageId] - Stage ID (defaults to chart/song data)
   * @param {Object} [registry] - Optional StageRegistry instance
   * @returns {boolean} Whether stage was created successfully
   */
  createStage(stageId, registry) {
    // Check if stage feature is enabled
    if (!this.isFeatureEnabled('stage')) {
      return false;
    }

    const id = stageId || this.chart?.stage || this.songData?.stage || Constants.DEFAULT_STAGE;

    this.stage = new Stage(this.scene, id);

    if (!this.stage.loadFromRegistry(registry)) {
      console.warn(`[PlayState] Failed to load stage: ${id}`);
      return false;
    }

    this.stage.create();

    // Apply stage camera zoom
    if (this.funkinCamera) {
      this.funkinCamera.setDefaultZoom(this.stage.cameraZoom);
      this.funkinCamera.setZoom(this.stage.cameraZoom, true);
    }

    return true;
  }

  // ========================================
  // CHARACTER SETUP (Task 4.3)
  // ========================================

  /**
   * Create all characters
   * @param {Object} [config] - Character configuration
   * @param {string} [config.player='bf'] - Player character ID
   * @param {string} [config.opponent='dad'] - Opponent character ID
   * @param {string} [config.girlfriend='gf'] - Girlfriend character ID
   * @param {Object} [registry] - Optional CharacterRegistry instance
   */
  createCharacters(config = {}, registry) {
    // Check if characters feature is enabled
    if (!this.isFeatureEnabled('characters')) {
      return;
    }

    const playerChar = config.player || this.chart?.player || this.songData?.player || 'bf';
    const opponentChar = config.opponent || this.chart?.opponent || this.songData?.opponent || 'dad';
    const gfChar = config.girlfriend || this.chart?.girlfriend || this.songData?.girlfriend || 'gf';

    // Create girlfriend first (usually behind other characters)
    this.girlfriend = this.createCharacter(gfChar, 'gf', false, registry);

    // Create opponent
    this.opponent = this.createCharacter(opponentChar, 'dad', false, registry);

    // Create player
    this.player = this.createCharacter(playerChar, 'bf', true, registry);

    // Position characters on stage
    this.positionCharacters();
  }

  /**
   * Create a single character
   * @param {string} characterId - Character ID
   * @param {string} charType - Character type for positioning ('bf', 'dad', 'gf')
   * @param {boolean} isPlayer - Whether this is the player character
   * @param {Object} [registry] - Optional CharacterRegistry instance
   * @returns {Character | null}
   */
  createCharacter(characterId, charType, isPlayer, registry) {
    if (!this.scene) return null;

    const character = new Character(this.scene, 0, 0, characterId, isPlayer);

    if (!character.loadFromRegistry(registry)) {
      console.warn(`[PlayState] Failed to load character: ${characterId}`);
      return null;
    }

    // Add to scene
    this.scene.add?.existing(character);

    return character;
  }

  /**
   * Position characters on the stage
   */
  positionCharacters() {
    if (!this.stage) return;

    if (this.player) {
      this.stage.positionCharacter(this.player, 'bf');
    }

    if (this.opponent) {
      this.stage.positionCharacter(this.opponent, 'dad');
    }

    if (this.girlfriend) {
      this.stage.positionCharacter(this.girlfriend, 'gf');
    }
  }

  /**
   * Get character by type
   * @param {string} charType - 'bf', 'dad', or 'gf'
   * @returns {Character | null}
   */
  getCharacter(charType) {
    switch (charType) {
      case 'bf':
      case 'player':
        return this.player;
      case 'dad':
      case 'opponent':
        return this.opponent;
      case 'gf':
      case 'girlfriend':
        return this.girlfriend;
      default:
        return null;
    }
  }

  /**
   * Set the audio manager
   * @param {Object} audioManager - AudioManager instance
   */
  setAudioManager(audioManager) {
    this.audioManager = audioManager;
  }

  /**
   * Set the voices group
   * @param {Object} voices - VoicesGroup instance
   */
  setVoices(voices) {
    this.voices = voices;
  }

  /**
   * Set the precise input handler
   * @param {Object} preciseInput - PreciseInput instance
   */
  setPreciseInput(preciseInput) {
    this.preciseInput = preciseInput;
  }

  /**
   * Enable or disable replay recording
   * @param {boolean} enabled - Whether to enable replay recording
   */
  setReplayRecordingEnabled(enabled) {
    this.replayRecordingEnabled = enabled;
    if (enabled && !this.replayRecorder) {
      this.replayRecorder = new ReplayRecorder();
    }
  }

  /**
   * Set the level system for feature toggles
   * @param {LevelSystem} levelSystem - LevelSystem instance
   */
  setLevelSystem(levelSystem) {
    this.levelSystem = levelSystem;
  }

  /**
   * Check if a feature is enabled via the level system
   * @param {string} featureName - Feature name to check
   * @returns {boolean} Whether the feature is enabled (true if no level system)
   */
  isFeatureEnabled(featureName) {
    // If no level system, all features are enabled (backward compatibility)
    if (!this.levelSystem) {
      return true;
    }
    return this.levelSystem.isFeatureEnabled(featureName);
  }

  /**
   * Enable or disable input buffer
   * @param {boolean} enabled - Whether to enable input buffer
   * @param {number} [windowMs=50] - Buffer window in ms
   */
  setInputBufferEnabled(enabled, windowMs = 50) {
    this.inputBufferEnabled = enabled;
    if (enabled && !this.inputBuffer) {
      this.inputBuffer = new InputBuffer(windowMs);
    } else if (!enabled && this.inputBuffer) {
      this.inputBuffer.clear();
    }
  }

  // ========================================
  // REPLAY PLAYBACK (Task 13.2)
  // ========================================

  /**
   * Load and start replay playback
   * @param {Object} replayData - The replay data to play back
   * @returns {boolean} Whether replay was loaded successfully
   */
  loadReplay(replayData) {
    if (!replayData) {
      console.error('[PlayState] No replay data provided');
      return false;
    }

    // Create replay player if needed
    if (!this.replayPlayer) {
      this.replayPlayer = new ReplayPlayer();
    }

    // Load the replay
    if (!this.replayPlayer.load(replayData)) {
      console.error('[PlayState] Failed to load replay');
      return false;
    }

    // Enable replay mode
    this.replayMode = true;

    // Disable replay recording in replay mode
    this.replayRecordingEnabled = false;

    return true;
  }

  /**
   * Start replay playback
   * Called when the song starts in replay mode
   */
  startReplayPlayback() {
    if (!this.replayMode || !this.replayPlayer) return;

    this.replayPlayer.start();

    // Create replay indicator
    this.createReplayIndicator();

    // Emit replay start event
    EventBus.emit(Events.REPLAY_START, {
      songId: this.replayPlayer.getSongId(),
      difficulty: this.replayPlayer.getDifficulty()
    });
  }

  /**
   * Create the replay indicator UI element
   */
  createReplayIndicator() {
    if (!this.scene?.add) return;

    // Create text indicator
    this.replayIndicator = this.scene.add.text(
      10,
      10,
      '▶ REPLAY',
      {
        fontFamily: 'Arial',
        fontSize: '24px',
        color: '#ff6b6b',
        stroke: '#000000',
        strokeThickness: 4
      }
    );

    // Set to HUD camera if available
    if (this.camHUD) {
      this.replayIndicator.setScrollFactor(0);
    }

    // Add pulsing animation
    if (this.scene.tweens) {
      this.scene.tweens.add({
        targets: this.replayIndicator,
        alpha: { from: 1, to: 0.5 },
        duration: 500,
        yoyo: true,
        repeat: -1
      });
    }
  }

  /**
   * Process replay inputs for the current song position
   * Called during update when in replay mode
   */
  processReplayInputs() {
    if (!this.replayMode || !this.replayPlayer || !this.replayPlayer.isPlaying()) {
      return;
    }

    // Get inputs that should fire at current position
    const inputs = this.replayPlayer.getInputsForPosition(this.songPosition);

    // Process each input
    for (const input of inputs) {
      if (input.type === 'press') {
        this.handleNoteInput(input.direction, input.time);
      } else if (input.type === 'release') {
        this.handleNoteRelease(input.direction, input.time);
      }
    }
  }

  /**
   * Stop replay playback
   */
  stopReplayPlayback() {
    if (this.replayPlayer) {
      this.replayPlayer.stop();
    }

    // Destroy replay indicator
    if (this.replayIndicator) {
      this.replayIndicator.destroy();
      this.replayIndicator = null;
    }

    // Emit replay stop event
    if (this.replayMode) {
      EventBus.emit(Events.REPLAY_STOP);
    }

    this.replayMode = false;
  }

  /**
   * Check if currently in replay mode
   * @returns {boolean}
   */
  isReplayMode() {
    return this.replayMode;
  }

  /**
   * Get the replay player instance
   * @returns {ReplayPlayer | null}
   */
  getReplayPlayer() {
    return this.replayPlayer;
  }

  // ========================================
  // NOTE GENERATION (Task 3.9)
  // ========================================

  /**
   * Generate notes from chart data
   */
  generateNotes() {
    if (!this.chart?.notes) return;

    // Player notes
    if (this.chart.notes.player && this.playerStrumline) {
      this.playerStrumline.applyNoteData(this.chart.notes.player);
    }

    // Opponent notes
    if (this.chart.notes.opponent && this.opponentStrumline) {
      this.opponentStrumline.applyNoteData(this.chart.notes.opponent);
    }
  }

  // ========================================
  // UPDATE LOOP
  // ========================================

  /**
   * Main update loop
   * @param {number} time - Current time
   * @param {number} delta - Delta time
   */
  update(time, delta) {
    // Track previous step/beat for event detection
    const prevStep = this.conductor.currentStep;
    const prevBeat = this.conductor.currentBeat;

    // Update song position from audio
    if (this.audioManager?.isPlaying) {
      this.songPosition = this.audioManager.currentTime;
    }

    // Update conductor
    this.conductor.update(this.songPosition);

    // Check for step/beat changes
    if (this.conductor.currentStep !== prevStep) {
      this.onStepHit(this.conductor.currentStep);
    }
    if (this.conductor.currentBeat !== prevBeat) {
      this.onBeatHit(this.conductor.currentBeat);
    }

    // Process input - use replay inputs in replay mode, live inputs otherwise
    if (this.replayMode) {
      this.processReplayInputs();
    } else {
      this.processInputQueue();
    }

    // Update strumlines
    if (this.playerStrumline) {
      this.playerStrumline.update(this.songPosition);
    }
    if (this.opponentStrumline) {
      this.opponentStrumline.update(this.songPosition);
    }

    // Process opponent notes (auto-hit)
    this.processOpponentNotes();

    // Update characters
    this.updateCharacters(delta);

    // Update stage
    if (this.stage) {
      this.stage.update(delta);
    }

    // Update camera
    if (this.funkinCamera) {
      this.funkinCamera.update(delta);
    }

    // Check for missed notes
    this.checkMissedNotes();

    // Check for song end
    if (this.songStarted && this.songPosition >= this.songLength) {
      this.endSong();
    }
  }

  /**
   * Update all characters
   * @param {number} delta - Delta time in ms
   */
  updateCharacters(delta) {
    // Calculate steps passed (approximate)
    const stepsPassed = delta / this.conductor.stepLengthMs;

    if (this.player) {
      this.player.update(delta, stepsPassed);
    }
    if (this.opponent) {
      this.opponent.update(delta, stepsPassed);
    }
    if (this.girlfriend) {
      this.girlfriend.update(delta, stepsPassed);
    }
  }

  // ========================================
  // BEAT/STEP SYNC (Task 4.3)
  // ========================================

  /**
   * Called when a step is hit
   * @param {number} step - Current step number
   */
  onStepHit(step) {
    // Update stage props
    if (this.stage) {
      this.stage.onStepHit(step);
    }

    // Update characters
    if (this.player) {
      this.player.onStepHit(step);
    }
    if (this.opponent) {
      this.opponent.onStepHit(step);
    }
    if (this.girlfriend) {
      this.girlfriend.onStepHit(step);
    }
  }

  /**
   * Called when a beat is hit
   * @param {number} beat - Current beat number
   */
  onBeatHit(beat) {
    // Update camera zoom
    if (this.funkinCamera) {
      this.funkinCamera.onBeatHit(beat);
    }

    // Update stage props
    if (this.stage) {
      this.stage.onBeatHit(beat);
    }

    // Update characters
    if (this.player) {
      this.player.onBeatHit(beat);
    }
    if (this.opponent) {
      this.opponent.onBeatHit(beat);
    }
    if (this.girlfriend) {
      this.girlfriend.onBeatHit(beat);
    }
  }

  // ========================================
  // INPUT PROCESSING (Task 3.10)
  // ========================================

  /**
   * Process input queue
   */
  processInputQueue() {
    // Get inputs from PreciseInput if available
    if (this.preciseInput) {
      const presses = this.preciseInput.consumePresses();
      const releases = this.preciseInput.consumeReleases();

      this.inputPressQueue.push(...presses);
      this.inputReleaseQueue.push(...releases);
    }

    // Process presses
    while (this.inputPressQueue.length > 0) {
      const input = this.inputPressQueue.shift();
      this.handleNoteInput(input.direction, input.timestamp);
    }

    // Process releases
    while (this.inputReleaseQueue.length > 0) {
      const input = this.inputReleaseQueue.shift();
      this.handleNoteRelease(input.direction, input.timestamp);
    }
  }

  /**
   * Handle note input (key press)
   * @param {number} direction - Direction (0-3)
   * @param {number} timestamp - Input timestamp
   */
  handleNoteInput(direction, timestamp) {
    if (!this.playerStrumline) return;

    // Record input for replay if recording
    if (this.replayRecorder && this.replayRecorder.isRecording()) {
      this.replayRecorder.recordInput('press', direction, `Key${direction}`, this.songPosition);
    }

    // Mark key as held
    this.playerStrumline.pressKey(direction);

    // Find closest note in hit window
    const note = this.playerStrumline.getClosestNote(direction, this.songPosition);

    if (note) {
      // Apply input delay compensation to the effective song position
      // Positive compensation: inputs treated as if they happened later (for early hitters)
      //   - We add to song position, making notes appear "earlier" relative to input
      // Negative compensation: inputs treated as if they happened earlier (for late hitters)
      //   - We subtract from song position, making notes appear "later" relative to input
      let effectiveSongPosition = this.songPosition;
      const saveManager = SaveManager.getInstance();
      if (saveManager && saveManager.loaded) {
        const compensation = saveManager.getInputDelayCompensation();
        effectiveSongPosition = this.songPosition + compensation;
      }

      // Calculate timing using adjusted song position
      // The timing is how early/late the input was relative to the note
      // Positive timing = note hasn't arrived yet (early hit)
      // Negative timing = note has passed (late hit)
      const timing = note.strumTime - effectiveSongPosition;
      const absTiming = Math.abs(timing);

      if (absTiming <= Constants.HIT_WINDOW_MS) {
        this.hitNote(note, timing);
        return;
      }
    }

    // Ghost tap (no note to hit)
    this.ghostMiss(direction);
  }

  /**
   * Handle note release (key up)
   * @param {number} direction - Direction (0-3)
   * @param {number} timestamp - Input timestamp
   */
  handleNoteRelease(direction, timestamp) {
    if (!this.playerStrumline) return;

    // Record input for replay if recording
    if (this.replayRecorder && this.replayRecorder.isRecording()) {
      this.replayRecorder.recordInput('release', direction, `Key${direction}`, this.songPosition);
    }

    // Mark key as released
    this.playerStrumline.releaseKey(direction);
    this.playerStrumline.playStatic(direction);
  }

  /**
   * Hit a note
   * @param {Object} note - The note sprite
   * @param {number} timing - Timing offset in ms
   */
  hitNote(note, timing) {
    const judgement = Scoring.judgeNote(timing);
    const noteScore = Scoring.scoreNote(timing);

    // Update score
    this.score += noteScore;

    // Update combo
    const breaksCombo = Scoring.doesJudgementBreakCombo(judgement);
    if (breaksCombo) {
      this.combo = 0;
    } else {
      this.combo++;
      this.maxCombo = Math.max(this.maxCombo, this.combo);
    }

    // Update tallies - killer counts as sick
    const tallyKey = judgement === 'killer' ? 'sick' : judgement;
    if (this.tallies[tallyKey] !== undefined) {
      this.tallies[tallyKey]++;
    }
    this.tallies.totalNotesHit++;
    this.tallies.combo = this.combo;
    this.tallies.maxCombo = this.maxCombo;

    // Update health
    const healthBonus = this.getHealthBonus(judgement);
    this.health = Math.max(Constants.HEALTH_MIN, Math.min(Constants.HEALTH_MAX, this.health + healthBonus));

    // Hit the note on strumline
    this.playerStrumline.hitNote(note);

    // Trigger player sing animation
    if (this.player) {
      this.player.sing(note.direction);
    }

    // Unmute player vocals on hit
    if (this.voices) {
      this.voices.unmutePlayer();
    }

    // Emit event
    EventBus.emit(Events.NOTE_HIT, {
      note,
      judgement,
      score: noteScore,
      timing,
      combo: this.combo
    });

    // Callback
    if (this.onNoteHit) {
      this.onNoteHit(note, judgement, noteScore, timing);
    }
  }

  /**
   * Ghost miss (pressed key with no note)
   * @param {number} direction - Direction
   */
  ghostMiss(direction) {
    // Only penalize if within ghost tap window
    // For now, just play press animation
    this.playerStrumline?.playPress(direction);

    // Optional: Apply ghost miss penalty
    // this.health += Constants.HEALTH_GHOST_MISS_PENALTY;
  }

  /**
   * Get health bonus for a judgement
   * @param {string} judgement - Judgement type
   * @returns {number}
   */
  getHealthBonus(judgement) {
    switch (judgement) {
      case 'killer':
        return Constants.HEALTH_KILLER_BONUS;
      case 'sick':
        return Constants.HEALTH_SICK_BONUS;
      case 'good':
        return Constants.HEALTH_GOOD_BONUS;
      case 'bad':
        return Constants.HEALTH_BAD_BONUS;
      case 'shit':
        return Constants.HEALTH_SHIT_BONUS;
      default:
        return 0;
    }
  }

  // ========================================
  // OPPONENT NOTES (Task 4.3)
  // ========================================

  /**
   * Process opponent notes (auto-hit)
   * Called during update to handle opponent strumline
   */
  processOpponentNotes() {
    if (!this.opponentStrumline) return;

    for (const note of this.opponentStrumline.notes) {
      if (!note || !note.alive) continue;
      if (note.hasBeenHit) continue;

      // Check if note should be hit
      if (note.strumTime <= this.songPosition) {
        this.opponentHitNote(note);
      }
    }
  }

  /**
   * Opponent hits a note
   * @param {Object} note - The note sprite
   */
  opponentHitNote(note) {
    // Mark as hit
    note.hasBeenHit = true;

    // Trigger opponent sing animation
    if (this.opponent) {
      this.opponent.sing(note.direction);
    }

    // Hit the note on strumline (visual feedback)
    this.opponentStrumline.hitNote(note);

    // Emit event
    EventBus.emit(Events.OPPONENT_NOTE_HIT, { note });
  }

  // ========================================
  // CAMERA FOCUS (Task 4.3)
  // ========================================

  /**
   * Focus camera on a character
   * @param {number} target - 0 = opponent, 1 = player, 2 = girlfriend
   * @param {boolean} [instant=false] - Whether to snap immediately
   */
  focusCamera(target, instant = false) {
    this.cameraFocusTarget = target;

    const character = this.getCameraFocusCharacter(target);
    if (!character || !this.funkinCamera) return;

    const focusPoint = character.getCameraFocusPoint();

    // Apply stage camera offset
    if (this.stage) {
      const charType = target === 0 ? 'dad' : target === 1 ? 'bf' : 'gf';
      const stageOffset = this.stage.getCameraOffset(charType);
      focusPoint.x += stageOffset.x;
      focusPoint.y += stageOffset.y;
    }

    this.funkinCamera.setFollowTarget(focusPoint.x, focusPoint.y, instant);
  }

  /**
   * Get the character for camera focus
   * @param {number} target - Focus target
   * @returns {Character | null}
   */
  getCameraFocusCharacter(target) {
    switch (target) {
      case 0:
        return this.opponent;
      case 1:
        return this.player;
      case 2:
        return this.girlfriend;
      default:
        return this.opponent;
    }
  }

  /**
   * Handle FocusCamera event from chart
   * @param {Object} eventData - Event data with char property
   */
  handleFocusCameraEvent(eventData) {
    const charIndex = eventData?.char ?? eventData?.value?.char ?? 0;
    this.focusCamera(charIndex);
  }

  /**
   * Handle ZoomCamera event from chart
   * @param {Object} eventData - Event data with zoom and duration
   */
  handleZoomCameraEvent(eventData) {
    if (!this.funkinCamera) return;

    const zoom = eventData?.zoom ?? eventData?.value?.zoom ?? 1.0;
    const instant = eventData?.instant ?? eventData?.value?.instant ?? false;

    this.funkinCamera.setZoom(zoom, instant);
  }

  // ========================================
  // MISS DETECTION (Task 3.11)
  // ========================================

  /**
   * Check for missed notes
   */
  checkMissedNotes() {
    if (!this.playerStrumline) return;

    const missThreshold = this.songPosition - Constants.HIT_WINDOW_MS;

    for (const note of this.playerStrumline.notes) {
      if (!note || !note.alive) continue;
      if (note.hasBeenHit || note.hasMissed) continue;

      // Check if note is past the hit window
      if (note.strumTime < missThreshold) {
        this.missNote(note);
      }
    }
  }

  /**
   * Miss a note
   * @param {Object} note - The note sprite
   */
  missNote(note) {
    // Mark as missed
    note.hasMissed = true;
    note.handledMiss = true;

    // Reset combo
    this.combo = 0;

    // Update tallies
    this.tallies.missed++;

    // Update health
    this.health = Math.max(Constants.HEALTH_MIN, this.health + Constants.HEALTH_MISS_PENALTY);

    // Trigger player miss animation
    if (this.player) {
      this.player.miss(note.direction);
    }

    // Mute player vocals
    if (this.voices) {
      this.voices.mutePlayer();
    }

    // Emit event
    EventBus.emit(Events.NOTE_MISS, { note });

    // Callback
    if (this.onNoteMiss) {
      this.onNoteMiss(note);
    }

    // Check for game over
    if (this.health <= Constants.HEALTH_MIN) {
      this.gameOver();
    }
  }

  // ========================================
  // COUNTDOWN (Task 3.12)
  // ========================================

  /**
   * Start the countdown
   */
  startCountdown() {
    this.countdownActive = true;
    this.countdownStep = 0;

    // Reset conductor
    this.conductor.reset();
    this.conductor.songPosition = -this.conductor.beatLengthMs * 4;

    // Emit countdown start
    EventBus.emit(Events.COUNTDOWN_START);

    // Schedule countdown steps
    this.scheduleCountdownStep(0); // 3
    this.scheduleCountdownStep(1); // 2
    this.scheduleCountdownStep(2); // 1
    this.scheduleCountdownStep(3); // GO
    this.scheduleCountdownStep(4); // Start song
  }

  /**
   * Schedule a countdown step
   * @param {number} step - Step number (0-4)
   */
  scheduleCountdownStep(step) {
    const delay = this.conductor.beatLengthMs * step;

    if (this.scene?.time) {
      this.scene.time.delayedCall(delay, () => {
        this.executeCountdownStep(step);
      });
    }
  }

  /**
   * Execute a countdown step
   * @param {number} step - Step number
   */
  executeCountdownStep(step) {
    this.countdownStep = step;

    if (step < 4) {
      // Countdown steps 0-3 (3, 2, 1, GO)
      const countdownNames = ['three', 'two', 'one', 'go'];
      const name = countdownNames[step];

      // Callback for visual/audio
      if (this.onCountdownStep) {
        this.onCountdownStep(step, name);
      }

      // Emit event
      EventBus.emit(Events.COUNTDOWN_STEP, { step, name });
    } else {
      // Step 4 - Start the song
      this.countdownActive = false;
      this.startSong();
    }
  }

  /**
   * Start the song
   */
  startSong() {
    this.songStarted = true;
    this.conductor.songPosition = 0;

    // Start replay playback if in replay mode
    if (this.replayMode) {
      this.startReplayPlayback();
    }
    // Start replay recording if enabled (not in replay mode) and feature is enabled
    else if (this.replayRecordingEnabled && this.replayRecorder && this.isFeatureEnabled('replayRecording')) {
      const songId = this.songData?.id || this.songData?.name || 'unknown';
      this.replayRecorder.start(songId, this.difficulty);
    }

    // Initialize input buffer if enabled and feature is enabled
    if (this.inputBufferEnabled && this.isFeatureEnabled('inputBuffer')) {
      const saveManager = SaveManager.getInstance();
      const bufferWindow = saveManager?.loaded ? saveManager.getOption('inputBufferWindow') ?? 50 : 50;
      if (!this.inputBuffer) {
        this.inputBuffer = new InputBuffer(bufferWindow);
      } else {
        this.inputBuffer.setBufferWindow(bufferWindow);
      }
    }

    // Start audio
    if (this.audioManager) {
      this.audioManager.play(this.startTimestamp);
    }

    // Emit event
    EventBus.emit(Events.SONG_START);
  }

  /**
   * End the song
   */
  endSong() {
    this.songStarted = false;

    // Capture replay mode state before stopping
    const wasReplayMode = this.replayMode;

    // Stop audio
    if (this.audioManager) {
      this.audioManager.stop();
    }

    // Stop replay playback if in replay mode
    if (this.replayMode) {
      this.stopReplayPlayback();
    }

    // Stop replay recording and get replay data
    let replayData = null;
    if (this.replayRecorder && this.replayRecorder.isRecording()) {
      replayData = this.replayRecorder.stop(this.score, this.tallies);
    }

    // Calculate final rank
    const rank = Scoring.calculateRank(this.tallies);

    // Emit event
    EventBus.emit(Events.SONG_END, {
      score: this.score,
      tallies: this.tallies,
      rank,
      replayData,
      isReplay: wasReplayMode
    });

    // Callback
    if (this.onSongEnd) {
      this.onSongEnd(this.score, this.tallies, rank, replayData);
    }
  }

  /**
   * Game over
   */
  gameOver() {
    this.songStarted = false;

    // Stop replay playback if in replay mode
    if (this.replayMode) {
      this.stopReplayPlayback();
    }

    // Discard replay recording on early exit
    if (this.replayRecorder && this.replayRecorder.isRecording()) {
      this.replayRecorder.discard();
    }

    // Stop audio
    if (this.audioManager) {
      this.audioManager.stop();
    }

    // Emit event
    EventBus.emit(Events.GAME_OVER, {
      score: this.score,
      tallies: this.tallies
    });
  }

  // ========================================
  // PAUSE/RESUME
  // ========================================

  /**
   * Pause the game
   */
  pause() {
    if (this.audioManager) {
      this.audioManager.pause();
    }

    EventBus.emit(Events.PAUSE);
  }

  /**
   * Resume the game
   */
  resume() {
    if (this.audioManager) {
      this.audioManager.resume();
    }

    EventBus.emit(Events.RESUME);
  }

  /**
   * Exit the song early (e.g., from pause menu)
   * Discards any in-progress replay recording
   */
  exitSong() {
    this.songStarted = false;

    // Stop replay playback if in replay mode
    if (this.replayMode) {
      this.stopReplayPlayback();
    }

    // Discard replay recording on early exit
    if (this.replayRecorder && this.replayRecorder.isRecording()) {
      this.replayRecorder.discard();
    }

    // Stop audio
    if (this.audioManager) {
      this.audioManager.stop();
    }
  }

  // ========================================
  // CLEANUP
  // ========================================

  /**
   * Destroy the play state
   */
  destroy() {
    // Destroy strumlines
    if (this.playerStrumline) {
      this.playerStrumline.destroy();
      this.playerStrumline = null;
    }

    if (this.opponentStrumline) {
      this.opponentStrumline.destroy();
      this.opponentStrumline = null;
    }

    // Destroy characters
    if (this.player) {
      this.player.destroy();
      this.player = null;
    }

    if (this.opponent) {
      this.opponent.destroy();
      this.opponent = null;
    }

    if (this.girlfriend) {
      this.girlfriend.destroy();
      this.girlfriend = null;
    }

    // Destroy stage
    if (this.stage) {
      this.stage.destroy();
      this.stage = null;
    }

    // Destroy camera controller
    if (this.funkinCamera) {
      this.funkinCamera.destroy();
      this.funkinCamera = null;
    }

    this.scene = null;
    this.conductor = null;
    this.audioManager = null;
    this.voices = null;
    this.preciseInput = null;
    this.chart = null;
    this.songData = null;
    this.camGame = null;
    this.camHUD = null;

    // Clean up replay recorder
    if (this.replayRecorder) {
      if (this.replayRecorder.isRecording()) {
        this.replayRecorder.discard();
      }
      this.replayRecorder = null;
    }

    // Clean up replay player
    if (this.replayPlayer) {
      if (this.replayPlayer.isPlaying()) {
        this.replayPlayer.stop();
      }
      this.replayPlayer = null;
    }

    // Clean up replay indicator
    if (this.replayIndicator) {
      this.replayIndicator.destroy();
      this.replayIndicator = null;
    }

    // Clean up input buffer
    if (this.inputBuffer) {
      this.inputBuffer.clear();
      this.inputBuffer = null;
    }

    // Clean up level system reference
    this.levelSystem = null;

    this.replayMode = false;
  }
}

export default PlayState;

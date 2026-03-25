/**
 * @fileoverview PlayState - Main gameplay scene orchestrator.
 * Delegates to focused modules: GameplayState, NoteProcessor,
 * InputManager, CameraController, and SongFlowController.
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
import { registerCharacterAnimations, registerPropAnimations } from '../graphics/AnimationRegistrar.js';
import { createGameplayState } from './GameplayState.js';
import { createNoteProcessor } from './NoteProcessor.js';
import { createInputManager } from './InputManager.js';
import { createCameraController } from './CameraController.js';
import { createSongFlowController } from './SongFlowController.js';

/**
 * Main gameplay scene for Friday Night Funkin'.
 * Orchestrates focused modules for note processing, input, camera, scoring, and song flow.
 */
class PlayState {
  // Core references
  scene = null;
  songData = null;
  difficulty = Constants.DEFAULT_DIFFICULTY;
  startTimestamp = 0;
  chart = null;
  conductor = null;

  // Gameplay state (kept on PlayState for backward compatibility)
  health = Constants.HEALTH_STARTING;
  score = 0;
  combo = 0;
  maxCombo = 0;
  tallies = { sick: 0, good: 0, bad: 0, shit: 0, missed: 0,
    combo: 0, maxCombo: 0, totalNotesHit: 0, totalNotes: 0 };

  // Timing
  songPosition = 0;
  songLength = 0;
  songStarted = false;
  countdownActive = false;
  countdownStep = 0;

  // Strumlines
  playerStrumline = null;
  opponentStrumline = null;

  // Input
  inputPressQueue = [];
  inputReleaseQueue = [];
  preciseInput = null;

  // Replay
  replayRecorder = null;
  replayRecordingEnabled = false;
  replayPlayer = null;
  replayMode = false;
  replayIndicator = null;

  // Systems
  levelSystem = null;
  inputBuffer = null;
  inputBufferEnabled = false;
  audioManager = null;
  voices = null;

  // Cameras (synced from CameraController for backward compat)
  camGame = null;
  camHUD = null;
  funkinCamera = null;
  cameraFocusTarget = 0;

  // Characters & Stage
  player = null;
  opponent = null;
  girlfriend = null;
  stage = null;

  // Callbacks
  onNoteHit = null;
  onNoteMiss = null;
  onSongEnd = null;
  onCountdownStep = null;

  // Modules (private)
  _gameplayState = null;
  _noteProcessor = null;
  _inputManager = null;
  _cameraController = null;
  _songFlowController = null;

  constructor(scene) {
    this.scene = scene;
    this.conductor = Conductor.instance;

    const context = {
      scene,
      playState: this,
      conductor: this.conductor,
      eventBus: EventBus,
      scoring: Scoring,
      gameplayState: null,
      noteProcessor: null,
    };

    this._gameplayState = createGameplayState(context);
    context.gameplayState = this._gameplayState;
    this._noteProcessor = createNoteProcessor(context);
    context.noteProcessor = this._noteProcessor;
    this._inputManager = createInputManager(context);
    this._cameraController = createCameraController(context);
    this._songFlowController = createSongFlowController(context);
  }

  init(config) {
    this.songData = config.song ?? null;
    this.difficulty = config.difficulty ?? Constants.DEFAULT_DIFFICULTY;
    this.startTimestamp = config.startTimestamp ?? 0;
    this.chart = config.chart ?? null;
    this.resetState();

    if (this.chart?.timeChanges) {
      this.conductor.mapTimeChanges(this.chart.timeChanges);
    }
    if (this.chart?.notes) {
      const allNotes = [...(this.chart.notes.player ?? []), ...(this.chart.notes.opponent ?? [])];
      if (allNotes.length > 0) {
        const lastNote = allNotes.reduce((a, b) => (a.time > b.time ? a : b));
        this.songLength = lastNote.time + (lastNote.length ?? 0) + 1000;
      }
    }
    if (this.chart?.notes?.player) {
      this.tallies.totalNotes = this.chart.notes.player.length;
    }
  }

  resetState() {
    this.health = Constants.HEALTH_STARTING;
    this.score = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.songPosition = 0;
    this.songStarted = false;
    this.countdownActive = false;
    this.countdownStep = 0;
    this.tallies = { sick: 0, good: 0, bad: 0, shit: 0, missed: 0,
      combo: 0, maxCombo: 0, totalNotesHit: 0, totalNotes: 0 };
    this.inputPressQueue = [];
    this.inputReleaseQueue = [];
  }

  createStrumlines(noteStyle = null, scrollSpeed = 1.0) {
    this.playerStrumline = new Strumline(this.scene, true, noteStyle, scrollSpeed);
    this.playerStrumline.setPosition(Constants.STRUMLINE_X_OFFSET + 560, Constants.STRUMLINE_Y_OFFSET);
    this.opponentStrumline = new Strumline(this.scene, false, noteStyle, scrollSpeed);
    this.opponentStrumline.setPosition(Constants.STRUMLINE_X_OFFSET, Constants.STRUMLINE_Y_OFFSET);
  }

  setupCameras() {
    this._cameraController.setupCameras();
    this.camGame = this._cameraController.camGame;
    this.camHUD = this._cameraController.camHUD;
    this.funkinCamera = this._cameraController.funkinCamera;
  }

  createStage(stageId, registry) {
    if (!this.isFeatureEnabled('stage')) return false;
    const id = stageId || this.chart?.stage || this.songData?.stage || Constants.DEFAULT_STAGE;
    this.stage = new Stage(this.scene, id);
    if (!this.stage.loadFromRegistry(registry)) {
      console.warn(`[PlayState] Failed to load stage: ${id}`);
      return false;
    }
    this.stage.create();
    if (this.funkinCamera) {
      this.funkinCamera.setDefaultZoom(this.stage.cameraZoom);
      this.funkinCamera.setZoom(this.stage.cameraZoom, true);
    }
    return true;
  }

  createCharacters(config = {}, registry) {
    if (!this.isFeatureEnabled('characters')) return;
    const playerChar = config.player || this.chart?.player || this.songData?.player || 'bf';
    const opponentChar = config.opponent || this.chart?.opponent || this.songData?.opponent || 'dad';
    const gfChar = config.girlfriend || this.chart?.girlfriend || this.songData?.girlfriend || 'gf';
    this.girlfriend = this.createCharacter(gfChar, 'gf', false, registry);
    this.opponent = this.createCharacter(opponentChar, 'dad', false, registry);
    this.player = this.createCharacter(playerChar, 'bf', true, registry);
    this.positionCharacters();
  }

  createCharacter(characterId, charType, isPlayer, registry) {
    if (!this.scene) return null;
    const character = new Character(this.scene, 0, 0, characterId, isPlayer);
    if (!character.loadFromRegistry(registry)) {
      console.warn(`[PlayState] Failed to load character: ${characterId}`);
      return null;
    }
    this.scene.add?.existing(character);
    return character;
  }

  positionCharacters() {
    if (!this.stage) return;
    if (this.player) this.stage.positionCharacter(this.player, 'bf');
    if (this.opponent) this.stage.positionCharacter(this.opponent, 'dad');
    if (this.girlfriend) this.stage.positionCharacter(this.girlfriend, 'gf');
  }

  wireCharacterAssets(characterRegistry) {
    const characters = [
      { ref: this.player, label: 'player' },
      { ref: this.opponent, label: 'opponent' },
      { ref: this.girlfriend, label: 'girlfriend' }
    ];
    for (const { ref } of characters) {
      if (!ref) continue;
      const id = ref.characterId;
      const textureKey = `char-${id}`;
      ref.setTexture(textureKey);
      registerCharacterAnimations(this.scene, textureKey, characterRegistry.getCharacterAnimations(id));
      ref.playAnimation(ref.characterData?.startingAnimation || 'idle');
    }
  }

  wireStageAssets(stageId, stageRegistry) {
    const props = stageRegistry.getStageProps(stageId);
    for (const prop of props) {
      const sprite = this.stage?.getProp(prop.name);
      if (!sprite) continue;
      const textureKey = `stage-${stageId}-${prop.name}`;
      sprite.setTexture(textureKey);
      if (prop.animations && prop.animations.length > 0) {
        registerPropAnimations(this.scene, textureKey, prop.animations);
        if (prop.startingAnimation) {
          sprite.playAnimation(prop.startingAnimation);
        }
      }
    }
  }

  wireAudio(sessionAudio) {
    if (sessionAudio.instrumental) {
      this.audioManager.loadInstrumental(sessionAudio.instrumental.key);
    }
    if (sessionAudio.vocals?.player && sessionAudio.vocals?.opponent) {
      this.voices.loadSplit(sessionAudio.vocals.player.key, sessionAudio.vocals.opponent.key);
    }
    if (sessionAudio.vocals?.combined) {
      this.voices.loadCombined(sessionAudio.vocals.combined.key);
    }
    this.audioManager.setVoices(this.voices);
  }

  getCharacter(charType) {
    switch (charType) {
      case 'bf': case 'player': return this.player;
      case 'dad': case 'opponent': return this.opponent;
      case 'gf': case 'girlfriend': return this.girlfriend;
      default: return null;
    }
  }

  // Setters
  setAudioManager(audioManager) { this.audioManager = audioManager; }
  setVoices(voices) { this.voices = voices; }
  setPreciseInput(preciseInput) { this.preciseInput = preciseInput; }
  setLevelSystem(levelSystem) { this.levelSystem = levelSystem; }

  setReplayRecordingEnabled(enabled) {
    this.replayRecordingEnabled = enabled;
    if (enabled && !this.replayRecorder) this.replayRecorder = new ReplayRecorder();
  }

  isFeatureEnabled(featureName) {
    if (!this.levelSystem) return true;
    return this.levelSystem.isFeatureEnabled(featureName);
  }

  setInputBufferEnabled(enabled, windowMs = 50) {
    this.inputBufferEnabled = enabled;
    if (enabled && !this.inputBuffer) {
      this.inputBuffer = new InputBuffer(windowMs);
    } else if (!enabled && this.inputBuffer) {
      this.inputBuffer.clear();
    }
  }

  // Replay playback
  loadReplay(replayData) {
    if (!replayData) { console.error('[PlayState] No replay data provided'); return false; }
    if (!this.replayPlayer) this.replayPlayer = new ReplayPlayer();
    if (!this.replayPlayer.load(replayData)) { console.error('[PlayState] Failed to load replay'); return false; }
    this.replayMode = true;
    this.replayRecordingEnabled = false;
    return true;
  }

  startReplayPlayback() {
    if (!this.replayMode || !this.replayPlayer) return;
    this.replayPlayer.start();
    this.createReplayIndicator();
    EventBus.emit(Events.REPLAY_START, {
      songId: this.replayPlayer.getSongId(),
      difficulty: this.replayPlayer.getDifficulty()
    });
  }

  createReplayIndicator() {
    if (!this.scene?.add) return;
    this.replayIndicator = this.scene.add.text(10, 10, '▶ REPLAY', {
      fontFamily: 'Arial', fontSize: '24px', color: '#ff6b6b',
      stroke: '#000000', strokeThickness: 4
    });
    if (this.camHUD) this.replayIndicator.setScrollFactor(0);
    if (this.scene.tweens) {
      this.scene.tweens.add({
        targets: this.replayIndicator,
        alpha: { from: 1, to: 0.5 }, duration: 500, yoyo: true, repeat: -1
      });
    }
  }

  processReplayInputs() {
    if (!this.replayMode || !this.replayPlayer || !this.replayPlayer.isPlaying()) return;
    const inputs = this.replayPlayer.getInputsForPosition(this.songPosition);
    for (const input of inputs) {
      if (input.type === 'press') this.handleNoteInput(input.direction, input.time);
      else if (input.type === 'release') this.handleNoteRelease(input.direction, input.time);
    }
  }

  stopReplayPlayback() {
    if (this.replayPlayer) this.replayPlayer.stop();
    if (this.replayIndicator) { this.replayIndicator.destroy(); this.replayIndicator = null; }
    if (this.replayMode) EventBus.emit(Events.REPLAY_STOP);
    this.replayMode = false;
  }

  isReplayMode() { return this.replayMode; }
  getReplayPlayer() { return this.replayPlayer; }

  // Note generation
  generateNotes() {
    if (!this.chart?.notes) return;
    if (this.chart.notes.player && this.playerStrumline) this.playerStrumline.applyNoteData(this.chart.notes.player);
    if (this.chart.notes.opponent && this.opponentStrumline) this.opponentStrumline.applyNoteData(this.chart.notes.opponent);
  }

  // Main update loop — delegates to modules
  update(time, delta) {
    const prevStep = this.conductor.currentStep;
    const prevBeat = this.conductor.currentBeat;

    if (this.audioManager?.isPlaying) this.songPosition = this.audioManager.currentTime;
    this.conductor.update(this.songPosition);

    if (this.conductor.currentStep !== prevStep) this.onStepHit(this.conductor.currentStep);
    if (this.conductor.currentBeat !== prevBeat) this.onBeatHit(this.conductor.currentBeat);

    if (this.replayMode) this.processReplayInputs();
    else this._inputManager.processInputQueue();

    if (this.playerStrumline) this.playerStrumline.update(this.songPosition);
    if (this.opponentStrumline) this.opponentStrumline.update(this.songPosition);

    this._noteProcessor.processOpponentNotes();
    this.updateCharacters(delta);
    if (this.stage) this.stage.update(delta);
    if (this._cameraController.funkinCamera) this._cameraController.funkinCamera.update(delta);
    this._noteProcessor.checkMissedNotes();

    if (this.songStarted && this.songPosition >= this.songLength) this.endSong();
  }

  updateCharacters(delta) {
    const stepsPassed = delta / this.conductor.stepLengthMs;
    if (this.player) this.player.update(delta, stepsPassed);
    if (this.opponent) this.opponent.update(delta, stepsPassed);
    if (this.girlfriend) this.girlfriend.update(delta, stepsPassed);
  }

  // Beat/step sync
  onStepHit(step) {
    if (this.stage) this.stage.onStepHit(step);
    if (this.player) this.player.onStepHit(step);
    if (this.opponent) this.opponent.onStepHit(step);
    if (this.girlfriend) this.girlfriend.onStepHit(step);
  }

  onBeatHit(beat) {
    if (this.funkinCamera) this.funkinCamera.onBeatHit(beat);
    if (this.stage) this.stage.onBeatHit(beat);
    if (this.player) this.player.onBeatHit(beat);
    if (this.opponent) this.opponent.onBeatHit(beat);
    if (this.girlfriend) this.girlfriend.onBeatHit(beat);
  }

  // Input/note delegation to modules
  processInputQueue() { this._inputManager.processInputQueue(); }
  handleNoteInput(direction, timestamp) { this._inputManager.handleNoteInput(direction, timestamp); }
  handleNoteRelease(direction, timestamp) { this._inputManager.handleNoteRelease(direction, timestamp); }
  hitNote(note, timing) { this._noteProcessor.hitNote(note, timing); }
  ghostMiss(direction) { this._noteProcessor.ghostMiss(direction); }
  processOpponentNotes() { this._noteProcessor.processOpponentNotes(); }
  opponentHitNote(note) { this._noteProcessor.opponentHitNote(note); }
  checkMissedNotes() { this._noteProcessor.checkMissedNotes(); }
  missNote(note) { this._noteProcessor.missNote(note); }

  getHealthBonus(judgement) {
    switch (judgement) {
      case 'killer': return Constants.HEALTH_KILLER_BONUS;
      case 'sick': return Constants.HEALTH_SICK_BONUS;
      case 'good': return Constants.HEALTH_GOOD_BONUS;
      case 'bad': return Constants.HEALTH_BAD_BONUS;
      case 'shit': return Constants.HEALTH_SHIT_BONUS;
      default: return 0;
    }
  }

  // Camera — kept on PlayState for backward compat with tests
  focusCamera(target, instant = false) {
    this.cameraFocusTarget = target;
    const character = this.getCameraFocusCharacter(target);
    if (!character || !this.funkinCamera) return;
    const focusPoint = character.getCameraFocusPoint();
    if (this.stage) {
      const charType = target === 0 ? 'dad' : target === 1 ? 'bf' : 'gf';
      const stageOffset = this.stage.getCameraOffset(charType);
      focusPoint.x += stageOffset.x;
      focusPoint.y += stageOffset.y;
    }
    this.funkinCamera.setFollowTarget(focusPoint.x, focusPoint.y, instant);
  }

  getCameraFocusCharacter(target) {
    switch (target) {
      case 0: return this.opponent;
      case 1: return this.player;
      case 2: return this.girlfriend;
      default: return this.opponent;
    }
  }

  handleFocusCameraEvent(eventData) {
    const charIndex = eventData?.char ?? eventData?.value?.char ?? 0;
    this.focusCamera(charIndex);
  }

  handleZoomCameraEvent(eventData) {
    if (!this.funkinCamera) return;
    const zoom = eventData?.zoom ?? eventData?.value?.zoom ?? 1.0;
    const instant = eventData?.instant ?? eventData?.value?.instant ?? false;
    this.funkinCamera.setZoom(zoom, instant);
  }

  // Song flow delegation
  startCountdown() { this._songFlowController.startCountdown(); }
  scheduleCountdownStep(step) { this._songFlowController.scheduleCountdownStep(step); }
  executeCountdownStep(step) { this._songFlowController.executeCountdownStep(step); }
  startSong() { this._songFlowController.startSong(); }
  endSong() { this._songFlowController.endSong(); }
  gameOver() { this._songFlowController.gameOver(); }

  // Pause/resume
  pause() {
    if (this.audioManager) this.audioManager.pause();
    EventBus.emit(Events.PAUSE);
  }

  resume() {
    if (this.audioManager) this.audioManager.resume();
    EventBus.emit(Events.RESUME);
  }

  exitSong() {
    this.songStarted = false;
    if (this.replayMode) this.stopReplayPlayback();
    if (this.replayRecorder && this.replayRecorder.isRecording()) this.replayRecorder.discard();
    if (this.audioManager) this.audioManager.stop();
  }

  // Cleanup — calls destroy() on each module
  destroy() {
    if (this._gameplayState) { this._gameplayState.destroy(); this._gameplayState = null; }
    if (this._noteProcessor) { this._noteProcessor.destroy(); this._noteProcessor = null; }
    if (this._inputManager) { this._inputManager.destroy(); this._inputManager = null; }
    if (this._cameraController) { this._cameraController.destroy(); this._cameraController = null; }
    if (this._songFlowController) { this._songFlowController.destroy(); this._songFlowController = null; }

    if (this.playerStrumline) { this.playerStrumline.destroy(); this.playerStrumline = null; }
    if (this.opponentStrumline) { this.opponentStrumline.destroy(); this.opponentStrumline = null; }
    if (this.player) { this.player.destroy(); this.player = null; }
    if (this.opponent) { this.opponent.destroy(); this.opponent = null; }
    if (this.girlfriend) { this.girlfriend.destroy(); this.girlfriend = null; }
    if (this.stage) { this.stage.destroy(); this.stage = null; }
    if (this.funkinCamera) { this.funkinCamera.destroy(); this.funkinCamera = null; }

    this.scene = null;
    this.conductor = null;
    this.audioManager = null;
    this.voices = null;
    this.preciseInput = null;
    this.chart = null;
    this.songData = null;
    this.camGame = null;
    this.camHUD = null;

    if (this.replayRecorder) {
      if (this.replayRecorder.isRecording()) this.replayRecorder.discard();
      this.replayRecorder = null;
    }
    if (this.replayPlayer) {
      if (this.replayPlayer.isPlaying()) this.replayPlayer.stop();
      this.replayPlayer = null;
    }
    if (this.replayIndicator) { this.replayIndicator.destroy(); this.replayIndicator = null; }
    if (this.inputBuffer) { this.inputBuffer.clear(); this.inputBuffer = null; }
    this.levelSystem = null;
    this.replayMode = false;
  }
}

export default PlayState;

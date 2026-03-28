/**
 * @fileoverview AudioManager - Central audio control for gameplay
 * Handles instrumental, vocal track, and sound effects playback with precise timing.
 *
 * Based on source/funkin/audio/FunkinSound.hx
 */

import * as Constants from '../core/Constants.js';

/**
 * @typedef {Object} AudioManagerConfig
 * @property {number} [volume=1.0] - Master volume (0-1)
 * @property {boolean} [muted=false] - Whether audio is muted
 */

/**
 * Sound effect keys
 * @readonly
 * @enum {string}
 */
export const SFXKeys = {
  // UI sounds
  SCROLL: 'sfx-scroll',
  CONFIRM: 'sfx-confirm',
  CANCEL: 'sfx-cancel',
  ERROR: 'sfx-error',

  // Countdown sounds
  COUNTDOWN_3: 'sfx-countdown-3',
  COUNTDOWN_2: 'sfx-countdown-2',
  COUNTDOWN_1: 'sfx-countdown-1',
  COUNTDOWN_GO: 'sfx-countdown-go',

  // Gameplay sounds
  MISS: 'sfx-miss',
  HITSOUND: 'sfx-hitsound',
  DEATH: 'sfx-death',
  RETRY: 'sfx-retry',

  // Result sounds
  RANK_REVEAL: 'sfx-rank-reveal',
  SCORE_TICK: 'sfx-score-tick'
};

/**
 * Manages audio playback for gameplay with sync support.
 */
class AudioManager {
  /**
   * The scene this manager belongs to
   * @type {Phaser.Scene | null}
   */
  scene = null;

  /**
   * The instrumental track
   * @type {Phaser.Sound.BaseSound | null}
   */
  instrumental = null;

  /**
   * The voices group
   * @type {Object | null}
   */
  voices = null;

  /**
   * Master volume (0-1)
   * @type {number}
   */
  masterVolume = 1.0;

  /**
   * Instrumental volume (0-1)
   * @type {number}
   */
  instrumentalVolume = 1.0;

  /**
   * Sound effects volume (0-1)
   * @type {number}
   */
  sfxVolume = 1.0;

  /**
   * Whether audio is muted
   * @type {boolean}
   */
  muted = false;

  /**
   * Whether audio is currently playing
   * @type {boolean}
   */
  isPlaying = false;

  /**
   * Whether audio is paused
   * @type {boolean}
   */
  isPaused = false;

  /**
   * The song length in milliseconds
   * @type {number}
   */
  songLength = 0;

  /**
   * Resync threshold in milliseconds
   * @type {number}
   */
  resyncThreshold = 20;

  /**
   * Callback when song ends
   * @type {Function | null}
   */
  onComplete = null;

  /**
   * Loaded sound effects cache
   * @type {Map<string, Phaser.Sound.BaseSound>}
   */
  sfxCache = new Map();

  /**
   * Create a new AudioManager
   * @param {Phaser.Scene} scene - The scene this manager belongs to
   */
  constructor(scene) {
    this.scene = scene;
    this.sfxCache = new Map();
  }

  // ========================================
  // LOADING
  // ========================================

  /**
   * Load the instrumental track
   * @param {string} key - The audio key
   * @returns {Phaser.Sound.BaseSound | null}
   */
  loadInstrumental(key) {
    if (!this.scene?.sound) {
      return null;
    }

    try {
      // Guard: if the Phaser audio cache is available, verify the key exists
      // before calling sound.add (which throws on missing keys in some builds).
      const audioCache = this.scene.cache?.audio;
      const cacheAvailable = audioCache && typeof audioCache.exists === 'function';
      if (cacheAvailable && !audioCache.exists(key)) {
        console.warn(`[AudioManager] Audio key not in cache: ${key}`);
        return null;
      }

      this.instrumental = this.scene.sound.add(key, {
        volume: this.instrumentalVolume * this.masterVolume
      });

      // Get song length
      if (this.instrumental.duration) {
        this.songLength = this.instrumental.duration * Constants.MS_PER_SEC;
      }

      // Setup complete callback
      this.instrumental.on('complete', () => {
        this.isPlaying = false;
        if (this.onComplete) {
          this.onComplete();
        }
      });

      return this.instrumental;
    } catch (e) {
      console.error('[AudioManager] Failed to load instrumental:', e);
      return null;
    }
  }

  /**
   * Set the voices group
   * @param {Object} voicesGroup - The VoicesGroup instance
   */
  setVoices(voicesGroup) {
    this.voices = voicesGroup;
  }

  /**
   * Check if audio is loaded
   * @returns {boolean}
   */
  isLoaded() {
    return this.instrumental !== null;
  }

  // ========================================
  // PLAYBACK CONTROL
  // ========================================

  /**
   * Play the audio from a specific time
   * @param {number} [startTime=0] - Start time in milliseconds
   */
  play(startTime = 0) {
    if (!this.instrumental) {
      // No instrumental loaded — mark as playing anyway so the game loop
      // can fall back to delta-based timing instead of freezing.
      this.isPlaying = false;
      return;
    }

    const seekTime = startTime / Constants.MS_PER_SEC;

    // Resume the Web Audio context if suspended (required on mobile browsers).
    // Mobile browsers block audio until a user gesture resumes the context.
    // We must wait for the context to actually be running before calling
    // play(), otherwise the play call is silently dropped on iOS/Android.
    const ctx = this.scene?.sound?.context;
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().then(() => {
        this._startPlayback(seekTime, startTime);
      }).catch(() => {
        // Context couldn't resume — try playing anyway in case Phaser
        // queues it, and let the delta-based fallback keep the game going.
        this._startPlayback(seekTime, startTime);
      });
      return;
    }

    this._startPlayback(seekTime, startTime);
  }

  /**
   * Internal helper that actually starts instrumental + voice playback.
   * Separated from play() so the Web Audio context resume can await before
   * triggering the underlying Phaser sound calls.
   * @param {number} seekTime - Seek position in seconds
   * @param {number} startTime - Start time in milliseconds (for voices)
   * @private
   */
  _startPlayback(seekTime, startTime) {
    try {
      this.instrumental.play({ seek: seekTime });
      this.isPlaying = true;
      this.isPaused = false;

      // Play voices if available
      if (this.voices) {
        this.voices.play(startTime);
      }
    } catch (e) {
      console.error('[AudioManager] Failed to play:', e);
      // Even on failure, mark as not playing so the delta fallback kicks in
      this.isPlaying = false;
    }
  }

  /**
   * Pause the audio
   */
  pause() {
    if (!this.instrumental || !this.isPlaying) {
      return;
    }

    try {
      this.instrumental.pause();
      this.isPaused = true;
      this.isPlaying = false;

      if (this.voices) {
        this.voices.pause();
      }
    } catch (e) {
      console.error('[AudioManager] Failed to pause:', e);
    }
  }

  /**
   * Resume the audio
   */
  resume() {
    if (!this.instrumental || !this.isPaused) {
      return;
    }

    try {
      this.instrumental.resume();
      this.isPaused = false;
      this.isPlaying = true;

      if (this.voices) {
        this.voices.resume();
      }
    } catch (e) {
      console.error('[AudioManager] Failed to resume:', e);
    }
  }

  /**
   * Stop the audio
   */
  stop() {
    if (!this.instrumental) {
      return;
    }

    try {
      this.instrumental.stop();
      this.isPlaying = false;
      this.isPaused = false;

      if (this.voices) {
        this.voices.stop();
      }
    } catch (e) {
      console.error('[AudioManager] Failed to stop:', e);
    }
  }

  /**
   * Seek to a specific time
   * @param {number} timeMs - Time in milliseconds
   */
  seek(timeMs) {
    if (!this.instrumental) {
      return;
    }

    const seekTime = Math.max(0, timeMs / Constants.MS_PER_SEC);

    try {
      this.instrumental.seek = seekTime;

      if (this.voices) {
        this.voices.seek(timeMs);
      }
    } catch (e) {
      console.error('[AudioManager] Failed to seek:', e);
    }
  }

  // ========================================
  // SYNC
  // ========================================

  /**
   * Get the current playback time in milliseconds
   * @returns {number}
   */
  get currentTime() {
    if (!this.instrumental) {
      return 0;
    }

    try {
      // Phaser's seek property returns time in seconds
      const seekTime = this.instrumental.seek ?? 0;
      return seekTime * Constants.MS_PER_SEC;
    } catch {
      return 0;
    }
  }

  /**
   * Check and resync voices if needed
   * @returns {boolean} Whether resync was performed
   */
  resync() {
    if (!this.instrumental || !this.voices) {
      return false;
    }

    const instTime = this.currentTime;
    const voicesTime = this.voices.currentTime;
    const drift = Math.abs(instTime - voicesTime);

    if (drift > this.resyncThreshold) {
      this.voices.seek(instTime);
      return true;
    }

    return false;
  }

  /**
   * Force resync voices to instrumental
   */
  forceResync() {
    if (!this.instrumental || !this.voices) {
      return;
    }
    this.voices.seek(this.currentTime);
  }

  // ========================================
  // VOLUME CONTROL
  // ========================================

  /**
   * Set the master volume
   * @param {number} volume - Volume (0-1)
   */
  setMasterVolume(volume) {
    this.masterVolume = Math.max(0, Math.min(1, volume));
    this.updateVolumes();
  }

  /**
   * Set the instrumental volume
   * @param {number} volume - Volume (0-1)
   */
  setInstrumentalVolume(volume) {
    this.instrumentalVolume = Math.max(0, Math.min(1, volume));
    this.updateVolumes();
  }

  /**
   * Update all volumes based on current settings
   */
  updateVolumes() {
    if (this.instrumental) {
      const effectiveVolume = this.muted ? 0 : this.instrumentalVolume * this.masterVolume;
      this.instrumental.setVolume(effectiveVolume);
    }

    if (this.voices) {
      this.voices.setMasterVolume(this.muted ? 0 : this.masterVolume);
    }
  }

  /**
   * Mute all audio
   */
  mute() {
    this.muted = true;
    this.updateVolumes();
  }

  /**
   * Unmute all audio
   */
  unmute() {
    this.muted = false;
    this.updateVolumes();
  }

  /**
   * Toggle mute state
   * @returns {boolean} New mute state
   */
  toggleMute() {
    this.muted = !this.muted;
    this.updateVolumes();
    return this.muted;
  }

  // ========================================
  // UTILITY
  // ========================================

  /**
   * Get the song duration in milliseconds
   * @returns {number}
   */
  get duration() {
    if (!this.instrumental) {
      return 0;
    }
    return (this.instrumental.duration ?? 0) * Constants.MS_PER_SEC;
  }

  /**
   * Get playback progress (0-1)
   * @returns {number}
   */
  get progress() {
    const dur = this.duration;
    if (dur <= 0) {
      return 0;
    }
    return this.currentTime / dur;
  }

  /**
   * Check if the song has ended
   * @returns {boolean}
   */
  get hasEnded() {
    if (!this.instrumental) {
      return false;
    }
    return this.currentTime >= this.duration - 100; // 100ms buffer
  }

  // ========================================
  // SOUND EFFECTS
  // ========================================

  /**
   * Load a sound effect
   * @param {string} key - The sound effect key
   * @returns {Phaser.Sound.BaseSound | null}
   */
  loadSFX(key) {
    if (!this.scene?.sound) {
      return null;
    }

    // Check if already cached
    if (this.sfxCache.has(key)) {
      return this.sfxCache.get(key) || null;
    }

    try {
      const sfx = this.scene.sound.add(key, {
        volume: this.sfxVolume * this.masterVolume
      });
      this.sfxCache.set(key, sfx);
      return sfx;
    } catch (e) {
      console.warn(`[AudioManager] Failed to load SFX: ${key}`, e);
      return null;
    }
  }

  /**
   * Play a sound effect
   * @param {string} key - The sound effect key
   * @param {Object} [config] - Playback configuration
   * @param {number} [config.volume] - Volume override (0-1)
   * @param {number} [config.rate] - Playback rate
   * @param {boolean} [config.loop] - Whether to loop
   * @returns {Phaser.Sound.BaseSound | null}
   */
  playSFX(key, config = {}) {
    if (!this.scene?.sound || this.muted) {
      return null;
    }

    try {
      // Get or create the sound
      let sfx = this.sfxCache.get(key);
      if (!sfx) {
        sfx = this.loadSFX(key);
      }

      if (!sfx) {
        return null;
      }

      // Calculate effective volume
      const volume = (config.volume ?? 1) * this.sfxVolume * this.masterVolume;

      // Play with config
      sfx.play({
        volume,
        rate: config.rate ?? 1,
        loop: config.loop ?? false
      });

      return sfx;
    } catch (e) {
      console.warn(`[AudioManager] Failed to play SFX: ${key}`, e);
      return null;
    }
  }

  /**
   * Stop a sound effect
   * @param {string} key - The sound effect key
   */
  stopSFX(key) {
    const sfx = this.sfxCache.get(key);
    if (sfx) {
      try {
        sfx.stop();
      } catch {
        // Ignore stop errors
      }
    }
  }

  /**
   * Stop all sound effects
   */
  stopAllSFX() {
    for (const sfx of this.sfxCache.values()) {
      try {
        sfx.stop();
      } catch {
        // Ignore stop errors
      }
    }
  }

  /**
   * Set the sound effects volume
   * @param {number} volume - Volume (0-1)
   */
  setSFXVolume(volume) {
    this.sfxVolume = Math.max(0, Math.min(1, volume));
    // Update cached SFX volumes
    for (const sfx of this.sfxCache.values()) {
      try {
        sfx.setVolume(this.sfxVolume * this.masterVolume);
      } catch {
        // Ignore volume errors
      }
    }
  }

  // ========================================
  // UI SOUND HELPERS
  // ========================================

  /**
   * Play scroll/navigate sound
   */
  playScroll() {
    this.playSFX(SFXKeys.SCROLL);
  }

  /**
   * Play confirm/select sound
   */
  playConfirm() {
    this.playSFX(SFXKeys.CONFIRM);
  }

  /**
   * Play cancel/back sound
   */
  playCancel() {
    this.playSFX(SFXKeys.CANCEL);
  }

  /**
   * Play error sound
   */
  playError() {
    this.playSFX(SFXKeys.ERROR);
  }

  // ========================================
  // GAMEPLAY SOUND HELPERS
  // ========================================

  /**
   * Play countdown sound
   * @param {number} count - Countdown number (3, 2, 1, 0 for GO)
   */
  playCountdown(count) {
    switch (count) {
      case 3:
        this.playSFX(SFXKeys.COUNTDOWN_3);
        break;
      case 2:
        this.playSFX(SFXKeys.COUNTDOWN_2);
        break;
      case 1:
        this.playSFX(SFXKeys.COUNTDOWN_1);
        break;
      case 0:
        this.playSFX(SFXKeys.COUNTDOWN_GO);
        break;
    }
  }

  /**
   * Play miss sound
   */
  playMiss() {
    this.playSFX(SFXKeys.MISS);
  }

  /**
   * Play hitsound (for SICK hits when enabled)
   */
  playHitsound() {
    this.playSFX(SFXKeys.HITSOUND);
  }

  /**
   * Play death sound
   */
  playDeath() {
    this.playSFX(SFXKeys.DEATH);
  }

  /**
   * Play retry sound
   */
  playRetry() {
    this.playSFX(SFXKeys.RETRY);
  }

  // ========================================
  // CLEANUP
  // ========================================

  /**
   * Destroy the audio manager
   */
  destroy() {
    this.stop();
    this.stopAllSFX();

    if (this.instrumental) {
      this.instrumental.destroy();
      this.instrumental = null;
    }

    if (this.voices) {
      this.voices.destroy();
      this.voices = null;
    }

    // Destroy cached SFX
    for (const sfx of this.sfxCache.values()) {
      try {
        sfx.destroy();
      } catch {
        // Ignore destroy errors
      }
    }
    this.sfxCache.clear();

    this.scene = null;
    this.onComplete = null;
  }
}

export default AudioManager;

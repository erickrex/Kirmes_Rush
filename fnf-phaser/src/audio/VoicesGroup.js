/**
 * @fileoverview VoicesGroup - Manages player and opponent vocal tracks
 * Handles muting on miss and volume control for vocal tracks.
 *
 * Based on source/funkin/audio/VoicesGroup.hx
 */

import * as Constants from '../core/Constants.js';

/**
 * Manages player and opponent vocal tracks with independent control.
 */
class VoicesGroup {
  /**
   * The scene this group belongs to
   * @type {Phaser.Scene | null}
   */
  scene = null;

  /**
   * Player vocal track
   * @type {Phaser.Sound.BaseSound | null}
   */
  playerVoice = null;

  /**
   * Opponent vocal track
   * @type {Phaser.Sound.BaseSound | null}
   */
  opponentVoice = null;

  /**
   * Combined voices track (if not split)
   * @type {Phaser.Sound.BaseSound | null}
   */
  combinedVoices = null;

  /**
   * Whether voices are split into player/opponent
   * @type {boolean}
   */
  isSplit = false;

  /**
   * Master volume for all voices
   * @type {number}
   */
  masterVolume = 1.0;

  /**
   * Player voice volume
   * @type {number}
   */
  playerVolume = 1.0;

  /**
   * Opponent voice volume
   * @type {number}
   */
  opponentVolume = 1.0;

  /**
   * Whether player voice is muted (e.g., on miss)
   * @type {boolean}
   */
  playerMuted = false;

  /**
   * Whether opponent voice is muted
   * @type {boolean}
   */
  opponentMuted = false;

  /**
   * Whether all voices are muted
   * @type {boolean}
   */
  allMuted = false;

  /**
   * Whether voices are currently playing
   * @type {boolean}
   */
  isPlaying = false;

  /**
   * Whether voices are paused
   * @type {boolean}
   */
  isPaused = false;

  /**
   * Create a new VoicesGroup
   * @param {Phaser.Scene} scene - The scene this group belongs to
   */
  constructor(scene) {
    this.scene = scene;
  }

  // ========================================
  // LOADING
  // ========================================

  /**
   * Load combined voices (single track)
   * @param {string} key - The audio key
   * @returns {Phaser.Sound.BaseSound | null}
   */
  loadCombined(key) {
    if (!this.scene?.sound) {
      return null;
    }

    try {
      this.combinedVoices = this.scene.sound.add(key, {
        volume: this.masterVolume
      });
      this.isSplit = false;
      return this.combinedVoices;
    } catch (e) {
      console.error('[VoicesGroup] Failed to load combined voices:', e);
      return null;
    }
  }

  /**
   * Load split voices (player and opponent tracks)
   * @param {string} playerKey - The player voice audio key
   * @param {string} opponentKey - The opponent voice audio key
   */
  loadSplit(playerKey, opponentKey) {
    if (!this.scene?.sound) {
      return;
    }

    try {
      if (playerKey) {
        this.playerVoice = this.scene.sound.add(playerKey, {
          volume: this.playerVolume * this.masterVolume
        });
      }

      if (opponentKey) {
        this.opponentVoice = this.scene.sound.add(opponentKey, {
          volume: this.opponentVolume * this.masterVolume
        });
      }

      this.isSplit = true;
    } catch (e) {
      console.error('[VoicesGroup] Failed to load split voices:', e);
    }
  }

  /**
   * Check if voices are loaded
   * @returns {boolean}
   */
  isLoaded() {
    if (this.isSplit) {
      return this.playerVoice !== null || this.opponentVoice !== null;
    }
    return this.combinedVoices !== null;
  }

  // ========================================
  // PLAYBACK CONTROL
  // ========================================

  /**
   * Play voices from a specific time
   * @param {number} [startTime=0] - Start time in milliseconds
   */
  play(startTime = 0) {
    const seekTime = startTime / Constants.MS_PER_SEC;

    try {
      if (this.isSplit) {
        if (this.playerVoice) {
          this.playerVoice.play({ seek: seekTime });
        }
        if (this.opponentVoice) {
          this.opponentVoice.play({ seek: seekTime });
        }
      } else if (this.combinedVoices) {
        this.combinedVoices.play({ seek: seekTime });
      }

      this.isPlaying = true;
      this.isPaused = false;
    } catch (e) {
      console.error('[VoicesGroup] Failed to play:', e);
    }
  }

  /**
   * Pause voices
   */
  pause() {
    try {
      if (this.isSplit) {
        if (this.playerVoice) {
          this.playerVoice.pause();
        }
        if (this.opponentVoice) {
          this.opponentVoice.pause();
        }
      } else if (this.combinedVoices) {
        this.combinedVoices.pause();
      }

      this.isPaused = true;
      this.isPlaying = false;
    } catch (e) {
      console.error('[VoicesGroup] Failed to pause:', e);
    }
  }

  /**
   * Resume voices
   */
  resume() {
    try {
      if (this.isSplit) {
        if (this.playerVoice) {
          this.playerVoice.resume();
        }
        if (this.opponentVoice) {
          this.opponentVoice.resume();
        }
      } else if (this.combinedVoices) {
        this.combinedVoices.resume();
      }

      this.isPaused = false;
      this.isPlaying = true;
    } catch (e) {
      console.error('[VoicesGroup] Failed to resume:', e);
    }
  }

  /**
   * Stop voices
   */
  stop() {
    try {
      if (this.isSplit) {
        if (this.playerVoice) {
          this.playerVoice.stop();
        }
        if (this.opponentVoice) {
          this.opponentVoice.stop();
        }
      } else if (this.combinedVoices) {
        this.combinedVoices.stop();
      }

      this.isPlaying = false;
      this.isPaused = false;
    } catch (e) {
      console.error('[VoicesGroup] Failed to stop:', e);
    }
  }

  /**
   * Seek to a specific time
   * @param {number} timeMs - Time in milliseconds
   */
  seek(timeMs) {
    const seekTime = Math.max(0, timeMs / Constants.MS_PER_SEC);

    try {
      if (this.isSplit) {
        if (this.playerVoice) {
          this.playerVoice.seek = seekTime;
        }
        if (this.opponentVoice) {
          this.opponentVoice.seek = seekTime;
        }
      } else if (this.combinedVoices) {
        this.combinedVoices.seek = seekTime;
      }
    } catch (e) {
      console.error('[VoicesGroup] Failed to seek:', e);
    }
  }

  // ========================================
  // MUTE CONTROL
  // ========================================

  /**
   * Mute player voice (e.g., on miss)
   */
  mutePlayer() {
    this.playerMuted = true;
    this.updateVolumes();
  }

  /**
   * Unmute player voice
   */
  unmutePlayer() {
    this.playerMuted = false;
    this.updateVolumes();
  }

  /**
   * Mute opponent voice
   */
  muteOpponent() {
    this.opponentMuted = true;
    this.updateVolumes();
  }

  /**
   * Unmute opponent voice
   */
  unmuteOpponent() {
    this.opponentMuted = false;
    this.updateVolumes();
  }

  /**
   * Mute all voices
   */
  muteAll() {
    this.allMuted = true;
    this.updateVolumes();
  }

  /**
   * Unmute all voices
   */
  unmuteAll() {
    this.allMuted = false;
    this.updateVolumes();
  }

  // ========================================
  // VOLUME CONTROL
  // ========================================

  /**
   * Set master volume for all voices
   * @param {number} volume - Volume (0-1)
   */
  setMasterVolume(volume) {
    this.masterVolume = Math.max(0, Math.min(1, volume));
    this.updateVolumes();
  }

  /**
   * Set player voice volume
   * @param {number} volume - Volume (0-1)
   */
  setPlayerVolume(volume) {
    this.playerVolume = Math.max(0, Math.min(1, volume));
    this.updateVolumes();
  }

  /**
   * Set opponent voice volume
   * @param {number} volume - Volume (0-1)
   */
  setOpponentVolume(volume) {
    this.opponentVolume = Math.max(0, Math.min(1, volume));
    this.updateVolumes();
  }

  /**
   * Update all voice volumes based on current settings
   */
  updateVolumes() {
    if (this.isSplit) {
      if (this.playerVoice) {
        const vol = this.allMuted || this.playerMuted ? 0 : this.playerVolume * this.masterVolume;
        this.playerVoice.setVolume(vol);
      }

      if (this.opponentVoice) {
        const vol =
          this.allMuted || this.opponentMuted ? 0 : this.opponentVolume * this.masterVolume;
        this.opponentVoice.setVolume(vol);
      }
    } else if (this.combinedVoices) {
      const vol = this.allMuted ? 0 : this.masterVolume;
      this.combinedVoices.setVolume(vol);
    }
  }

  // ========================================
  // UTILITY
  // ========================================

  /**
   * Get the current playback time in milliseconds
   * @returns {number}
   */
  get currentTime() {
    try {
      if (this.isSplit) {
        // Use player voice time, or opponent if player not available
        const voice = this.playerVoice ?? this.opponentVoice;
        if (voice) {
          return (voice.seek ?? 0) * Constants.MS_PER_SEC;
        }
      } else if (this.combinedVoices) {
        return (this.combinedVoices.seek ?? 0) * Constants.MS_PER_SEC;
      }
    } catch {
      // Ignore errors
    }
    return 0;
  }

  /**
   * Get the duration in milliseconds
   * @returns {number}
   */
  get duration() {
    try {
      if (this.isSplit) {
        const voice = this.playerVoice ?? this.opponentVoice;
        if (voice) {
          return (voice.duration ?? 0) * Constants.MS_PER_SEC;
        }
      } else if (this.combinedVoices) {
        return (this.combinedVoices.duration ?? 0) * Constants.MS_PER_SEC;
      }
    } catch {
      // Ignore errors
    }
    return 0;
  }

  // ========================================
  // CLEANUP
  // ========================================

  /**
   * Destroy the voices group
   */
  destroy() {
    this.stop();

    if (this.playerVoice) {
      this.playerVoice.destroy();
      this.playerVoice = null;
    }

    if (this.opponentVoice) {
      this.opponentVoice.destroy();
      this.opponentVoice = null;
    }

    if (this.combinedVoices) {
      this.combinedVoices.destroy();
      this.combinedVoices = null;
    }

    this.scene = null;
  }
}

export default VoicesGroup;

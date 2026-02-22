/**
 * @fileoverview PlayScene - Phaser Scene wrapper for PlayState
 * Bridges PlayState (plain class) with Phaser's scene system.
 */

import Phaser from 'phaser';
import PlayState from '../play/PlayState.js';

/**
 * PlayScene - Phaser.Scene that delegates to PlayState for gameplay logic.
 * @extends Phaser.Scene
 */
export default class PlayScene extends Phaser.Scene {
  constructor() {
    super({ key: 'PlayState' });

    /** @type {PlayState | null} */
    this.playState = null;

    /** @type {Object | null} */
    this.initData = null;
  }

  /**
   * @param {Object} data - Scene data passed from scene.start()
   */
  init(data) {
    this.initData = data || {};
  }

  preload() {
    this.load.setPath('assets/');

    // Suppress individual load errors — PlayState handles missing assets gracefully
    this.load.on('loaderror', (file) => {
      console.warn(`[PlayScene] Asset not found: ${file.key}`);
    });
  }

  create() {
    this.playState = new PlayState(this);

    // Build config from scene data
    const config = {
      song: this.initData.song || this.initData.songData || null,
      difficulty: this.initData.difficulty || 'normal',
      startTimestamp: this.initData.startTimestamp || 0,
      chart: this.initData.chart || null
    };

    this.playState.init(config);
    this.playState.setupCameras();
    this.playState.createStrumlines();
    this.playState.generateNotes();
    this.playState.startCountdown();
  }

  /**
   * @param {number} time
   * @param {number} delta
   */
  update(time, delta) {
    if (this.playState) {
      this.playState.update(time, delta);
    }
  }

  shutdown() {
    if (this.playState) {
      this.playState.destroy();
      this.playState = null;
    }
    this.initData = null;
  }
}

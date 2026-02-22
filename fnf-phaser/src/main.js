/**
 * @fileoverview Main entry point for Friday Night Funkin' Phaser JS
 */

import Phaser from 'phaser';
import TitleState from './ui/TitleState.js';

/**
 * Game configuration
 * @type {Phaser.Types.Core.GameConfig}
 */
const config = {
  type: Phaser.AUTO,
  width: 1280,
  height: 720,
  parent: 'game-container',
  backgroundColor: '#000000',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH
  },
  physics: {
    default: 'arcade',
    arcade: {
      debug: false
    }
  },
  scene: [TitleState]
};

/**
 * The main Phaser game instance
 * @type {Phaser.Game}
 */
const game = new Phaser.Game(config);

export default game;

/**
 * @fileoverview Game configuration and initialization for Friday Night Funkin' Phaser JS
 */

import Phaser from 'phaser';

/**
 * Creates and returns the Phaser game configuration
 * @param {Phaser.Types.Scenes.SceneType[]} scenes - Array of scene classes to include
 * @returns {Phaser.Types.Core.GameConfig} The game configuration object
 */
export function createGameConfig(scenes = []) {
  return {
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
    audio: {
      disableWebAudio: false
    },
    render: {
      pixelArt: false,
      antialias: true,
      antialiasGL: true
    },
    scene: scenes
  };
}

/**
 * Initializes and returns a new Phaser game instance
 * @param {Phaser.Types.Scenes.SceneType[]} scenes - Array of scene classes to include
 * @returns {Phaser.Game} The initialized game instance
 */
export function initGame(scenes = []) {
  const config = createGameConfig(scenes);
  return new Phaser.Game(config);
}

export default { createGameConfig, initGame };

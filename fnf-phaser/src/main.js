/**
 * @fileoverview Main entry point for Friday Night Funkin' Phaser JS
 */

import Phaser from 'phaser';
import BootScene from './scenes/BootScene.js';
import TitleState from './ui/TitleState.js';
import MainMenuState from './ui/MainMenuState.js';
import StoryMenuState from './ui/StoryMenuState.js';
import FreeplayState from './ui/FreeplayState.js';
import OptionsState from './ui/OptionsState.js';
import PlayScene from './scenes/PlayScene.js';
import PauseSubState from './ui/PauseSubState.js';
import GameOverState from './ui/GameOverState.js';
import ResultState from './ui/ResultState.js';
import LoadingState from './ui/LoadingState.js';
import ReplayBrowserState from './ui/ReplayBrowserState.js';

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
  audio: {
    disableWebAudio: false
  },
  render: {
    pixelArt: false,
    antialias: true,
    antialiasGL: true
  },
  scene: [
    TitleState,
    MainMenuState,
    StoryMenuState,
    FreeplayState,
    OptionsState,
    PlayScene,
    PauseSubState,
    GameOverState,
    ResultState,
    LoadingState,
    ReplayBrowserState,
    BootScene
  ]
};

/**
 * The main Phaser game instance
 * @type {Phaser.Game}
 */
const game = new Phaser.Game(config);

export default game;

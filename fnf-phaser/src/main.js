/**
 * @fileoverview Main entry point for Friday Night Funkin' Phaser JS
 */

import Phaser from './phaser.js';
import TitleState from './ui/TitleState.js';
import MainMenuState from './ui/MainMenuState.js';
import StoryMenuState from './ui/StoryMenuState.js';
import FreeplayState from './ui/FreeplayState.js';
import LevelSelectState from './ui/LevelSelectState.js';
import OptionsState from './ui/OptionsState.js';
import PlayScene from './scenes/PlayScene.js';
import PauseSubState from './ui/PauseSubState.js';
import GameOverState from './ui/GameOverState.js';
import ResultState from './ui/ResultState.js';
import LoadingState from './ui/LoadingState.js';
import ReplayBrowserState from './ui/ReplayBrowserState.js';
import SaveManager from './data/SaveManager.js';
import TouchDeviceDetector from './input/TouchDeviceDetector.js';
import OrientationOverlay from './ui/OrientationOverlay.js';

/**
 * Game configuration
 * @type {Phaser.Types.Core.GameConfig}
 */
const config = {
  type: Phaser.AUTO,
  width: 720,
  height: 1280,
  parent: 'game-container',
  backgroundColor: '#000000',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH
  },
  audio: {
    disableWebAudio: false
  },
  input: {
    activePointers: 4
  },
  render: {
    pixelArt: false,
    antialias: true,
    antialiasGL: true
  },
  scene: [
    TitleState,
    MainMenuState,
    LevelSelectState,
    StoryMenuState,
    FreeplayState,
    OptionsState,
    PlayScene,
    PauseSubState,
    GameOverState,
    ResultState,
    LoadingState,
    ReplayBrowserState
  ]
};

/**
 * The main Phaser game instance
 * @type {Phaser.Game}
 */
SaveManager.getInstance().init();
TouchDeviceDetector.detect();
OrientationOverlay.init();

const game = new Phaser.Game(config);

game.events.once(Phaser.Core.Events.DESTROY, () => {
  OrientationOverlay.destroy();
});

export default game;

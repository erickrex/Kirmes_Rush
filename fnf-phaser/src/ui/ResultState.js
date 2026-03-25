/**
 * @fileoverview Result State - End of song results screen
 * Implements FR-6.7: Results display with score, rank, and tallies
 */

import Phaser from 'phaser';
import * as Constants from '../core/Constants.js';
import Scoring from '../play/Scoring.js';

/**
 * ResultState - Displays final score and rank after completing a song
 * @extends Phaser.Scene
 */
export default class ResultState extends Phaser.Scene {
  constructor() {
    super({ key: 'ResultState' });

    /**
     * Final score
     * @type {number}
     */
    this.score = 0;

    /**
     * Score tallies
     * @type {Object}
     */
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

    /**
     * Calculated rank
     * @type {string}
     */
    this.rank = 'N/A';

    /**
     * Song data
     * @type {Object | null}
     */
    this.songData = null;

    /**
     * Displayed score (for animation)
     * @type {number}
     */
    this.displayedScore = 0;

    /**
     * Score text object
     * @type {Phaser.GameObjects.Text | null}
     */
    this.scoreText = null;

    /**
     * Rank text object
     * @type {Phaser.GameObjects.Text | null}
     */
    this.rankText = null;

    /**
     * Accuracy text
     * @type {Phaser.GameObjects.Text | null}
     */
    this.accuracyText = null;

    /**
     * Whether transitioning
     * @type {boolean}
     */
    this.transitioning = false;

    /**
     * Result music
     * @type {Phaser.Sound.BaseSound | null}
     */
    this.resultMusic = null;

    /**
     * Whether score animation is complete
     * @type {boolean}
     */
    this.scoreAnimationComplete = false;
  }

  /**
   * Initialize with data from play state
   * @param {Object} data - Result data
   */
  init(data) {
    this.score = data?.score || 0;
    this.tallies = data?.tallies || this.tallies;
    this.rank = data?.rank || Scoring.calculateRank(this.tallies);
    this.songData = data?.songData || null;
    this.displayedScore = 0;
    this.transitioning = false;
    this.scoreAnimationComplete = false;
  }

  /**
   * Preload assets
   */
  preload() {
    this.load.setPath('assets/');

    // Rank images
    this.load.image('rank-perfect', 'images/results/rankPerfect.png');
    this.load.image('rank-excellent', 'images/results/rankExcellent.png');
    this.load.image('rank-great', 'images/results/rankGreat.png');
    this.load.image('rank-good', 'images/results/rankGood.png');
    this.load.image('rank-loss', 'images/results/rankLoss.png');

    // Result music (rank-specific)
    this.load.audio('result-music-perfect', 'audio/resultsPerfect.mp3');
    this.load.audio('result-music-excellent', 'audio/resultsExcellent.mp3');
    this.load.audio('result-music-normal', 'audio/resultsNormal.mp3');
  }

  /**
   * Create the results screen
   */
  create() {
    const { width, height } = this.cameras.main;

    // Background
    this.createBackground();

    // Song info
    this.createSongInfo();

    // Score display
    this.createScoreDisplay();

    // Tallies breakdown
    this.createTalliesDisplay();

    // Rank display
    this.createRankDisplay();

    // Continue prompt
    this.createContinuePrompt();

    // Setup input
    this.setupInput();

    // Play result music
    this.playResultMusic();

    // Start score animation
    this.animateScore();

    // Fade in
    this.cameras.main.fadeIn(500, 0, 0, 0);
  }

  /**
   * Create background
   */
  createBackground() {
    const { width, height } = this.cameras.main;

    // Gradient based on rank
    const graphics = this.add.graphics();
    const colors = this.getRankColors();

    graphics.fillGradientStyle(colors.top, colors.top, colors.bottom, colors.bottom, 1);
    graphics.fillRect(0, 0, width, height);
  }

  /**
   * Get colors based on rank
   * @returns {{top: number, bottom: number}}
   */
  getRankColors() {
    switch (this.rank) {
      case 'PERFECT':
        return { top: 0xffd700, bottom: 0xff8c00 };
      case 'EXCELLENT':
        return { top: 0x00ff00, bottom: 0x006400 };
      case 'GREAT':
        return { top: 0x00bfff, bottom: 0x0000cd };
      case 'GOOD':
        return { top: 0x9370db, bottom: 0x4b0082 };
      default:
        return { top: 0x2f2f2f, bottom: 0x1a1a1a };
    }
  }

  /**
   * Create song info display
   */
  createSongInfo() {
    const { width } = this.cameras.main;

    // Song name
    const songName = this.songData?.songName || 'Unknown Song';
    this.add.text(width / 2, 50, songName, {
      fontFamily: 'Arial Black',
      fontSize: '48px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 4
    }).setOrigin(0.5, 0.5);

    // Difficulty
    const difficulty = this.songData?.difficulty || 'normal';
    this.add.text(width / 2, 100, difficulty.toUpperCase(), {
      fontFamily: 'Arial',
      fontSize: '24px',
      color: '#cccccc'
    }).setOrigin(0.5, 0.5);
  }

  /**
   * Create score display
   */
  createScoreDisplay() {
    const { width, height } = this.cameras.main;

    // Score label
    this.add.text(width / 2, height / 2 - 100, 'SCORE', {
      fontFamily: 'Arial',
      fontSize: '32px',
      color: '#ffffff'
    }).setOrigin(0.5, 0.5);

    // Score value
    this.scoreText = this.add.text(width / 2, height / 2 - 40, '0', {
      fontFamily: 'Arial Black',
      fontSize: '72px',
      color: '#ffff00',
      stroke: '#000000',
      strokeThickness: 6
    }).setOrigin(0.5, 0.5);

    // Accuracy
    const accuracy = this.calculateAccuracy();
    this.accuracyText = this.add.text(width / 2, height / 2 + 30, `${accuracy.toFixed(2)}%`, {
      fontFamily: 'Arial',
      fontSize: '36px',
      color: '#00ff00'
    }).setOrigin(0.5, 0.5);
    this.accuracyText.setAlpha(0);
  }

  /**
   * Create tallies breakdown display
   */
  createTalliesDisplay() {
    const { width, height } = this.cameras.main;
    const startX = 100;
    const startY = height / 2 + 100;
    const spacing = 120;

    const talliesData = [
      { label: 'SICK', value: this.tallies.sick, color: '#00ffff' },
      { label: 'GOOD', value: this.tallies.good, color: '#00ff00' },
      { label: 'BAD', value: this.tallies.bad, color: '#ffff00' },
      { label: 'SHIT', value: this.tallies.shit, color: '#ff8800' },
      { label: 'MISS', value: this.tallies.missed, color: '#ff0000' }
    ];

    this.tallyTexts = [];

    talliesData.forEach((tally, index) => {
      const x = startX + index * spacing;

      // Label
      this.add.text(x, startY, tally.label, {
        fontFamily: 'Arial',
        fontSize: '18px',
        color: '#888888'
      }).setOrigin(0, 0);

      // Value
      const valueText = this.add.text(x, startY + 25, '0', {
        fontFamily: 'Arial Black',
        fontSize: '32px',
        color: tally.color
      }).setOrigin(0, 0);

      this.tallyTexts.push({ text: valueText, target: tally.value });
    });

    // Max combo
    this.add.text(startX + talliesData.length * spacing, startY, 'MAX COMBO', {
      fontFamily: 'Arial',
      fontSize: '18px',
      color: '#888888'
    }).setOrigin(0, 0);

    this.maxComboText = this.add.text(startX + talliesData.length * spacing, startY + 25, '0', {
      fontFamily: 'Arial Black',
      fontSize: '32px',
      color: '#ffffff'
    }).setOrigin(0, 0);
  }

  /**
   * Create rank display
   */
  createRankDisplay() {
    const { width, height } = this.cameras.main;

    // Rank image or text
    const rankKey = `rank-${this.rank.toLowerCase()}`;

    if (this.textures.exists(rankKey)) {
      this.rankSprite = this.add.sprite(width - 150, height / 2, rankKey);
      this.rankSprite.setScale(0);
    } else {
      // Fallback text
      this.rankText = this.add.text(width - 150, height / 2, this.rank, {
        fontFamily: 'Arial Black',
        fontSize: '64px',
        color: this.getRankTextColor(),
        stroke: '#000000',
        strokeThickness: 4
      }).setOrigin(0.5, 0.5);
      this.rankText.setScale(0);
    }
  }

  /**
   * Get rank text color
   * @returns {string}
   */
  getRankTextColor() {
    switch (this.rank) {
      case 'PERFECT':
        return '#ffd700';
      case 'EXCELLENT':
        return '#00ff00';
      case 'GREAT':
        return '#00bfff';
      case 'GOOD':
        return '#9370db';
      default:
        return '#888888';
    }
  }

  /**
   * Create continue prompt
   */
  createContinuePrompt() {
    const { width, height } = this.cameras.main;

    this.continueText = this.add.text(width / 2, height - 50, 'Press ENTER to continue', {
      fontFamily: 'Arial',
      fontSize: '24px',
      color: '#ffffff'
    }).setOrigin(0.5, 0.5);
    this.continueText.setAlpha(0);
  }

  /**
   * Setup input
   */
  setupInput() {
    this.input.keyboard.on('keydown-ENTER', this.onContinue, this);
    this.input.keyboard.on('keydown-SPACE', this.onContinue, this);
    this.input.keyboard.on('keydown-ESC', this.onContinue, this);
  }

  /**
   * Play result music based on rank
   */
  playResultMusic() {
    let musicKey = 'result-music-normal';

    if (this.rank === 'PERFECT' && this.cache.audio.exists('result-music-perfect')) {
      musicKey = 'result-music-perfect';
    } else if (this.rank === 'EXCELLENT' && this.cache.audio.exists('result-music-excellent')) {
      musicKey = 'result-music-excellent';
    }

    if (this.cache.audio.exists(musicKey)) {
      this.resultMusic = this.sound.add(musicKey, {
        loop: true,
        volume: 0.7
      });
      this.resultMusic.play();
    }
  }

  /**
   * Animate score counter
   */
  animateScore() {
    // Animate score counting up
    this.tweens.addCounter({
      from: 0,
      to: this.score,
      duration: 2000,
      ease: 'Cubic.easeOut',
      onUpdate: (tween) => {
        this.displayedScore = Math.floor(tween.getValue());
        if (this.scoreText) {
          this.scoreText.setText(this.displayedScore.toLocaleString());
        }
      },
      onComplete: () => {
        this.onScoreAnimationComplete();
      }
    });

    // Animate tallies
    this.time.delayedCall(500, () => {
      this.animateTallies();
    });
  }

  /**
   * Animate tallies counting up
   */
  animateTallies() {
    this.tallyTexts.forEach((tally, index) => {
      this.time.delayedCall(index * 200, () => {
        this.tweens.addCounter({
          from: 0,
          to: tally.target,
          duration: 500,
          ease: 'Cubic.easeOut',
          onUpdate: (tween) => {
            tally.text.setText(Math.floor(tween.getValue()).toString());
          }
        });
      });
    });

    // Max combo
    this.time.delayedCall(this.tallyTexts.length * 200, () => {
      this.tweens.addCounter({
        from: 0,
        to: this.tallies.maxCombo,
        duration: 500,
        ease: 'Cubic.easeOut',
        onUpdate: (tween) => {
          if (this.maxComboText) {
            this.maxComboText.setText(Math.floor(tween.getValue()).toString());
          }
        }
      });
    });
  }

  /**
   * Called when score animation completes
   */
  onScoreAnimationComplete() {
    this.scoreAnimationComplete = true;

    // Show accuracy
    this.tweens.add({
      targets: this.accuracyText,
      alpha: 1,
      duration: 300
    });

    // Animate rank appearance
    this.animateRank();

    // Show continue prompt
    this.time.delayedCall(1000, () => {
      this.tweens.add({
        targets: this.continueText,
        alpha: 1,
        duration: 500
      });
    });
  }

  /**
   * Animate rank appearance
   */
  animateRank() {
    const target = this.rankSprite || this.rankText;
    if (!target) return;

    this.tweens.add({
      targets: target,
      scale: 1,
      duration: 500,
      ease: 'Back.easeOut'
    });

    // Add bounce effect
    this.tweens.add({
      targets: target,
      y: target.y - 10,
      duration: 500,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });
  }

  /**
   * Calculate accuracy percentage
   * @returns {number}
   */
  calculateAccuracy() {
    if (this.tallies.totalNotes === 0) return 0;
    return (this.tallies.totalNotesHit / this.tallies.totalNotes) * 100;
  }

  /**
   * Handle continue input
   */
  onContinue() {
    if (this.transitioning) return;

    // If score animation not complete, skip to end
    if (!this.scoreAnimationComplete) {
      this.tweens.killAll();
      this.displayedScore = this.score;
      if (this.scoreText) {
        this.scoreText.setText(this.score.toLocaleString());
      }
      this.onScoreAnimationComplete();
      return;
    }

    this.transitioning = true;

    // Stop music
    if (this.resultMusic) {
      this.resultMusic.stop();
    }

    // Transition out
    this.cameras.main.fadeOut(500, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      // Return to freeplay or story mode based on context
      const returnScene = this.songData?.returnScene || 'FreeplayState';
      this.scene.start(returnScene, this.songData?.returnSceneData);
    });
  }

  /**
   * Update loop
   * @param {number} time - Time
   * @param {number} delta - Delta
   */
  update(time, delta) {
    // Pulse continue text
    if (this.continueText && this.continueText.alpha > 0) {
      const pulse = 1 + Math.sin(time / 200) * 0.1;
      this.continueText.setScale(pulse);
    }
  }

  /**
   * Cleanup
   */
  shutdown() {
    this.input.keyboard.off('keydown-ENTER', this.onContinue, this);
    this.input.keyboard.off('keydown-SPACE', this.onContinue, this);
    this.input.keyboard.off('keydown-ESC', this.onContinue, this);

    if (this.resultMusic) {
      this.resultMusic.stop();
      this.resultMusic = null;
    }

    this.scoreText = null;
    this.rankText = null;
    this.accuracyText = null;
    this.continueText = null;
    this.tallyTexts = [];
    this.songData = null;
  }
}

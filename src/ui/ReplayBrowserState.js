/**
 * @fileoverview Replay Browser State - Browse and manage saved replays
 * Implements Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6 from competitive features spec
 *
 * Features:
 * - Display list of replays with song name, difficulty, score, accuracy, date
 * - Navigation and selection
 * - Delete with confirmation
 * - Song filter
 * - Empty state handling
 *
 * Retained intentionally as future replay-mode scaffolding. It stays hidden
 * from the current shipped menu until the release path supports it end-to-end.
 */

import Phaser from '../phaser.js';
import { ReplayManager } from '../replay/ReplaySystem.js';
import Transitions, { TransitionType } from '../graphics/Transitions.js';

/**
 * @typedef {import('../replay/ReplaySystem.js').ReplayListEntry} ReplayListEntry
 * @typedef {{
 *   songText: Phaser.GameObjects.Text | null,
 *   difficultyText: Phaser.GameObjects.Text | null,
 *   scoreText: Phaser.GameObjects.Text | null,
 *   accuracyText: Phaser.GameObjects.Text | null,
 *   dateText: Phaser.GameObjects.Text | null
 * }} ReplayInfoPanel
 */

/**
 * ReplayBrowserState - Browse and manage saved replays
 * @extends Phaser.Scene
 */
export default class ReplayBrowserState extends Phaser.Scene {
  constructor() {
    super({ key: 'ReplayBrowserState' });

    /**
     * Replay manager instance
     * @type {ReplayManager | null}
     */
    this.replayManager = null;

    /**
     * All replays from manager
     * @type {ReplayListEntry[]}
     */
    this.allReplays = [];

    /**
     * Filtered replays list
     * @type {ReplayListEntry[]}
     */
    this.filteredReplays = [];

    /**
     * Currently selected replay index
     * @type {number}
     */
    this.selectedIndex = 0;

    /**
     * Replay entry displays
     * @type {Phaser.GameObjects.Container[]}
     */
    this.replayDisplays = [];

    /**
     * Number of visible entries
     * @type {number}
     */
    this.visibleEntries = 8;

    /**
     * Scroll offset for list
     * @type {number}
     */
    this.scrollOffset = 0;

    /**
     * Whether transitioning
     * @type {boolean}
     */
    this.transitioning = false;

    /**
     * Whether showing delete confirmation
     * @type {boolean}
     */
    this.showingDeleteConfirm = false;

    /**
     * Delete confirmation overlay
     * @type {Phaser.GameObjects.Container | null}
     */
    this.deleteConfirmOverlay = null;

    /**
     * Current song filter (null for all)
     * @type {string | null}
     */
    this.songFilter = null;

    /**
     * Available songs for filtering
     * @type {string[]}
     */
    this.availableSongs = [];

    /**
     * Current song filter index
     * @type {number}
     */
    this.songFilterIndex = 0;

    /**
     * Filter display text
     * @type {Phaser.GameObjects.Text | null}
     */
    this.filterText = null;

    /**
     * Empty state text
     * @type {Phaser.GameObjects.Text | null}
     */
    this.emptyStateText = null;

    /**
     * Info panel elements
     * @type {ReplayInfoPanel}
     */
    this.infoPanel = {
      songText: null,
      difficultyText: null,
      scoreText: null,
      accuracyText: null,
      dateText: null
    };

    /**
     * Shared scene-transition helper. Constructed lazily on first use
     * (see `getTransitions`) and destroyed in `shutdown`.
     * @type {Transitions | null}
     */
    this.transitions = null;
  }

  /**
   * Lazily construct and return this scene's {@link Transitions} instance,
   * routing scene changes through the shared fade contract instead of an
   * ad-hoc `cameras.main.fadeOut(...)` duplication.
   * @returns {Transitions}
   */
  getTransitions() {
    if (!this.transitions) {
      this.transitions = new Transitions(this);
    }
    return this.transitions;
  }

  /**
   * Preload assets
   */
  preload() {
    this.load.setPath('assets/');

    if (!this.cache.audio.exists('scroll-sound')) {
      this.load.audio(
        'scroll-sound',
        'assets/rythm-foundation.assets/preload/sounds/scrollMenu.mp3'
      );
    }
    if (!this.cache.audio.exists('confirm-sound')) {
      this.load.audio(
        'confirm-sound',
        'assets/rythm-foundation.assets/preload/sounds/confirmMenu.mp3'
      );
    }
    if (!this.cache.audio.exists('cancel-sound')) {
      this.load.audio(
        'cancel-sound',
        'assets/rythm-foundation.assets/preload/sounds/cancelMenu.mp3'
      );
    }
  }

  /**
   * Create the replay browser
   */
  create() {
    this.transitioning = false;
    this.showingDeleteConfirm = false;
    this.selectedIndex = 0;
    this.scrollOffset = 0;
    this.songFilter = null;
    this.songFilterIndex = 0;

    // Initialize replay manager
    this.replayManager = new ReplayManager();

    // Load replays
    this.loadReplays();

    const { width } = this.cameras.main;

    // Background
    this.createBackground();

    // Title
    this.add
      .text(width / 2, 40, 'REPLAY BROWSER', {
        fontFamily: 'Arial Black',
        fontSize: '48px',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 4
      })
      .setOrigin(0.5, 0.5);

    // Replay list
    this.createReplayList();

    // Info panel
    this.createInfoPanel();

    // Filter display
    this.createFilterDisplay();

    // Empty state
    this.createEmptyState();

    // Delete confirmation overlay
    this.createDeleteConfirmOverlay();

    // Instructions
    this.createInstructions();

    // Setup input
    this.setupInput();

    // Update display
    this.updateDisplay();

    // Fade in
    this.cameras.main.fadeIn(500, 0, 0, 0);

    this.events?.on('shutdown', this.shutdown, this);
  }

  /**
   * Load replays from manager
   */
  loadReplays() {
    if (!this.replayManager) {
      this.allReplays = [];
      this.availableSongs = ['ALL'];
      this.applyFilter();
      return;
    }
    this.allReplays = this.replayManager.getReplayList();

    // Extract unique songs for filtering
    const songSet = new Set(this.allReplays.map((r) => r.songId));
    this.availableSongs = ['ALL', ...Array.from(songSet).sort()];

    this.applyFilter();
  }

  /**
   * Apply current song filter
   */
  applyFilter() {
    if (this.songFilter === null || this.songFilter === 'ALL') {
      this.filteredReplays = [...this.allReplays];
    } else {
      this.filteredReplays = this.replayManager?.filterBySong(this.songFilter) || [];
    }

    // Clamp selected index
    this.selectedIndex = Math.min(this.selectedIndex, Math.max(0, this.filteredReplays.length - 1));

    // Update scroll offset
    this.updateScrollOffset();
  }

  /**
   * Create background
   */
  createBackground() {
    const { width, height } = this.cameras.main;
    const graphics = this.add.graphics();
    graphics.fillGradientStyle(0x1a2a3a, 0x1a2a3a, 0x0a1a2a, 0x0a1a2a, 1);
    graphics.fillRect(0, 0, width, height);
  }

  /**
   * Create replay list display
   */
  createReplayList() {
    const startY = 100;
    const entryHeight = 60;

    this.replayDisplays = [];

    for (let i = 0; i < this.visibleEntries; i++) {
      const y = startY + i * entryHeight;
      const container = this.createReplayEntry(50, y);
      this.replayDisplays.push(container);
    }
  }

  /**
   * Create a single replay entry display
   * @param {number} x - X position
   * @param {number} y - Y position
   * @returns {Phaser.GameObjects.Container}
   */
  createReplayEntry(x, y) {
    const { width } = this.cameras.main;
    const container = this.add.container(x, y);

    // Background
    const bg = this.add.graphics();
    bg.fillStyle(0x000000, 0.6);
    bg.fillRoundedRect(0, 0, width - 400, 55, 8);
    container.add(bg);
    container.setData('bg', bg);

    // Song name
    const songText = this.add.text(15, 8, '', {
      fontFamily: 'Arial',
      fontSize: '22px',
      color: '#ffffff'
    });
    container.add(songText);
    container.setData('songText', songText);

    // Difficulty badge
    const diffText = this.add.text(15, 32, '', {
      fontFamily: 'Arial',
      fontSize: '14px',
      color: '#888888'
    });
    container.add(diffText);
    container.setData('diffText', diffText);

    // Score
    const scoreText = this.add.text(width - 600, 8, '', {
      fontFamily: 'Arial',
      fontSize: '20px',
      color: '#ffff00'
    });
    container.add(scoreText);
    container.setData('scoreText', scoreText);

    // Accuracy
    const accText = this.add.text(width - 600, 32, '', {
      fontFamily: 'Arial',
      fontSize: '14px',
      color: '#00ff00'
    });
    container.add(accText);
    container.setData('accText', accText);

    // Date
    const dateText = this.add.text(width - 480, 18, '', {
      fontFamily: 'Arial',
      fontSize: '14px',
      color: '#aaaaaa'
    });
    container.add(dateText);
    container.setData('dateText', dateText);

    return container;
  }

  /**
   * Create info panel for selected replay
   */
  createInfoPanel() {
    const { width } = this.cameras.main;
    const panelX = width - 320;
    const panelY = 100;

    // Panel background
    const graphics = this.add.graphics();
    graphics.fillStyle(0x000000, 0.8);
    graphics.fillRoundedRect(panelX - 20, panelY, 320, 280, 10);

    // Title
    this.add.text(panelX, panelY + 15, 'REPLAY INFO', {
      fontFamily: 'Arial Black',
      fontSize: '20px',
      color: '#ffffff'
    });

    // Song
    this.add.text(panelX, panelY + 55, 'Song:', {
      fontFamily: 'Arial',
      fontSize: '16px',
      color: '#888888'
    });
    this.infoPanel.songText = this.add.text(panelX, panelY + 75, '-', {
      fontFamily: 'Arial',
      fontSize: '20px',
      color: '#ffffff'
    });

    // Difficulty
    this.add.text(panelX, panelY + 105, 'Difficulty:', {
      fontFamily: 'Arial',
      fontSize: '16px',
      color: '#888888'
    });
    this.infoPanel.difficultyText = this.add.text(panelX, panelY + 125, '-', {
      fontFamily: 'Arial',
      fontSize: '20px',
      color: '#ffffff'
    });

    // Score
    this.add.text(panelX, panelY + 155, 'Score:', {
      fontFamily: 'Arial',
      fontSize: '16px',
      color: '#888888'
    });
    this.infoPanel.scoreText = this.add.text(panelX, panelY + 175, '-', {
      fontFamily: 'Arial Black',
      fontSize: '24px',
      color: '#ffff00'
    });

    // Accuracy
    this.add.text(panelX, panelY + 210, 'Accuracy:', {
      fontFamily: 'Arial',
      fontSize: '16px',
      color: '#888888'
    });
    this.infoPanel.accuracyText = this.add.text(panelX, panelY + 230, '-', {
      fontFamily: 'Arial',
      fontSize: '20px',
      color: '#00ff00'
    });

    // Date
    this.add.text(panelX + 150, panelY + 210, 'Date:', {
      fontFamily: 'Arial',
      fontSize: '16px',
      color: '#888888'
    });
    this.infoPanel.dateText = this.add.text(panelX + 150, panelY + 230, '-', {
      fontFamily: 'Arial',
      fontSize: '14px',
      color: '#aaaaaa'
    });
  }

  /**
   * Create filter display
   */
  createFilterDisplay() {
    const { width, height } = this.cameras.main;

    this.add.text(width - 320, height - 150, 'FILTER BY SONG:', {
      fontFamily: 'Arial',
      fontSize: '16px',
      color: '#888888'
    });

    this.filterText = this.add.text(width - 320, height - 125, 'ALL', {
      fontFamily: 'Arial',
      fontSize: '20px',
      color: '#00ffff'
    });

    // Filter arrows
    this.add.text(width - 340, height - 125, '<', {
      fontFamily: 'Arial',
      fontSize: '20px',
      color: '#ffffff'
    });

    this.add.text(width - 120, height - 125, '>', {
      fontFamily: 'Arial',
      fontSize: '20px',
      color: '#ffffff'
    });
  }

  /**
   * Create empty state display
   */
  createEmptyState() {
    const { width, height } = this.cameras.main;

    this.emptyStateText = this.add
      .text(width / 2 - 150, height / 2, 'No replays found', {
        fontFamily: 'Arial',
        fontSize: '32px',
        color: '#888888'
      })
      .setOrigin(0.5, 0.5);

    this.emptyStateText.setVisible(false);
  }

  /**
   * Create delete confirmation overlay
   */
  createDeleteConfirmOverlay() {
    const { width, height } = this.cameras.main;

    this.deleteConfirmOverlay = this.add.container(0, 0);
    this.deleteConfirmOverlay.setVisible(false);
    this.deleteConfirmOverlay.setDepth(100);

    // Darken background
    const bg = this.add.graphics();
    bg.fillStyle(0x000000, 0.8);
    bg.fillRect(0, 0, width, height);
    this.deleteConfirmOverlay.add(bg);

    // Confirmation box
    const boxWidth = 400;
    const boxHeight = 180;
    const boxX = (width - boxWidth) / 2;
    const boxY = (height - boxHeight) / 2;

    const box = this.add.graphics();
    box.fillStyle(0x222222, 1);
    box.fillRoundedRect(boxX, boxY, boxWidth, boxHeight, 10);
    box.lineStyle(2, 0xff0000, 1);
    box.strokeRoundedRect(boxX, boxY, boxWidth, boxHeight, 10);
    this.deleteConfirmOverlay.add(box);

    // Title
    const title = this.add
      .text(width / 2, boxY + 30, 'DELETE REPLAY?', {
        fontFamily: 'Arial Black',
        fontSize: '28px',
        color: '#ff0000'
      })
      .setOrigin(0.5, 0.5);
    this.deleteConfirmOverlay.add(title);

    // Message
    const message = this.add
      .text(width / 2, boxY + 70, 'This action cannot be undone.', {
        fontFamily: 'Arial',
        fontSize: '18px',
        color: '#ffffff'
      })
      .setOrigin(0.5, 0.5);
    this.deleteConfirmOverlay.add(message);

    // Options
    const confirmText = this.add
      .text(width / 2 - 80, boxY + 130, 'ENTER: Confirm', {
        fontFamily: 'Arial',
        fontSize: '16px',
        color: '#ff0000'
      })
      .setOrigin(0.5, 0.5);
    this.deleteConfirmOverlay.add(confirmText);

    const cancelText = this.add
      .text(width / 2 + 80, boxY + 130, 'ESC: Cancel', {
        fontFamily: 'Arial',
        fontSize: '16px',
        color: '#00ff00'
      })
      .setOrigin(0.5, 0.5);
    this.deleteConfirmOverlay.add(cancelText);
  }

  /**
   * Create instructions
   */
  createInstructions() {
    const { width, height } = this.cameras.main;

    this.add
      .text(
        width / 2,
        height - 30,
        'UP/DOWN: Navigate | ENTER: Play | DELETE/BACKSPACE: Delete | LEFT/RIGHT: Filter | ESC: Back',
        {
          fontFamily: 'Arial',
          fontSize: '14px',
          color: '#666666'
        }
      )
      .setOrigin(0.5, 0.5);
  }

  /**
   * Setup input handlers
   */
  setupInput() {
    const kb = this.input.keyboard;
    if (!kb) {
      return;
    }
    // Navigation
    kb.on('keydown-UP', this.onNavigateUp, this);
    kb.on('keydown-DOWN', this.onNavigateDown, this);
    kb.on('keydown-W', this.onNavigateUp, this);
    kb.on('keydown-S', this.onNavigateDown, this);

    // Filter
    kb.on('keydown-LEFT', this.onFilterLeft, this);
    kb.on('keydown-RIGHT', this.onFilterRight, this);
    kb.on('keydown-A', this.onFilterLeft, this);
    kb.on('keydown-D', this.onFilterRight, this);

    // Selection
    kb.on('keydown-ENTER', this.onSelect, this);
    kb.on('keydown-SPACE', this.onSelect, this);

    // Delete
    kb.on('keydown-DELETE', this.onDelete, this);
    kb.on('keydown-BACKSPACE', this.onDeleteKey, this);

    // Back
    kb.on('keydown-ESC', this.onBack, this);
  }

  /**
   * Navigate up
   */
  onNavigateUp() {
    if (this.transitioning || this.showingDeleteConfirm) {
      return;
    }
    if (this.filteredReplays.length === 0) {
      return;
    }

    this.selectedIndex--;
    if (this.selectedIndex < 0) {
      this.selectedIndex = this.filteredReplays.length - 1;
    }

    this.updateScrollOffset();
    this.playScrollSound();
    this.updateDisplay();
  }

  /**
   * Navigate down
   */
  onNavigateDown() {
    if (this.transitioning || this.showingDeleteConfirm) {
      return;
    }
    if (this.filteredReplays.length === 0) {
      return;
    }

    this.selectedIndex++;
    if (this.selectedIndex >= this.filteredReplays.length) {
      this.selectedIndex = 0;
    }

    this.updateScrollOffset();
    this.playScrollSound();
    this.updateDisplay();
  }

  /**
   * Filter left (previous song)
   */
  onFilterLeft() {
    if (this.transitioning || this.showingDeleteConfirm) {
      return;
    }
    if (this.availableSongs.length === 0) {
      return;
    }

    this.songFilterIndex--;
    if (this.songFilterIndex < 0) {
      this.songFilterIndex = this.availableSongs.length - 1;
    }

    this.songFilter = this.availableSongs[this.songFilterIndex];
    if (this.songFilter === 'ALL') {
      this.songFilter = null;
    }

    this.applyFilter();
    this.playScrollSound();
    this.updateDisplay();
  }

  /**
   * Filter right (next song)
   */
  onFilterRight() {
    if (this.transitioning || this.showingDeleteConfirm) {
      return;
    }
    if (this.availableSongs.length === 0) {
      return;
    }

    this.songFilterIndex++;
    if (this.songFilterIndex >= this.availableSongs.length) {
      this.songFilterIndex = 0;
    }

    this.songFilter = this.availableSongs[this.songFilterIndex];
    if (this.songFilter === 'ALL') {
      this.songFilter = null;
    }

    this.applyFilter();
    this.playScrollSound();
    this.updateDisplay();
  }

  /**
   * Select current replay to play
   */
  onSelect() {
    if (this.transitioning) {
      return;
    }

    if (this.showingDeleteConfirm) {
      // Confirm delete
      this.confirmDelete();
      return;
    }

    if (this.filteredReplays.length === 0) {
      return;
    }

    this.transitioning = true;
    this.playConfirmSound();

    const replay = this.filteredReplays[this.selectedIndex];
    this.startReplayPlayback(replay);
  }

  /**
   * Handle delete key press
   */
  onDelete() {
    if (this.transitioning) {
      return;
    }
    if (this.filteredReplays.length === 0) {
      return;
    }

    if (this.showingDeleteConfirm) {
      return;
    }

    this.showDeleteConfirmation();
  }

  /**
   * Handle backspace key (delete or back depending on context)
   */
  onDeleteKey() {
    if (this.transitioning) {
      return;
    }

    if (this.showingDeleteConfirm) {
      // Cancel delete
      this.cancelDelete();
      return;
    }

    // Show delete confirmation if we have replays
    if (this.filteredReplays.length > 0) {
      this.showDeleteConfirmation();
    }
  }

  /**
   * Go back
   */
  async onBack() {
    if (this.showingDeleteConfirm) {
      this.cancelDelete();
      return;
    }

    if (this.transitioning) {
      return;
    }

    this.transitioning = true;
    this.playCancelSound();

    await this.getTransitions().transitionOut({ type: TransitionType.FADE, duration: 500 });
    if (!this.transitions) {
      return;
    }
    this.scene.start('MainMenuState');
  }

  /**
   * Show delete confirmation
   */
  showDeleteConfirmation() {
    this.showingDeleteConfirm = true;
    this.deleteConfirmOverlay?.setVisible(true);
  }

  /**
   * Cancel delete
   */
  cancelDelete() {
    this.showingDeleteConfirm = false;
    this.deleteConfirmOverlay?.setVisible(false);
    this.playCancelSound();
  }

  /**
   * Confirm and execute delete
   */
  confirmDelete() {
    const replay = this.filteredReplays[this.selectedIndex];
    if (!replay) {
      this.cancelDelete();
      return;
    }

    // Delete the replay
    this.replayManager?.deleteReplay(replay.id);

    // Reload replays
    this.loadReplays();

    // Hide confirmation
    this.showingDeleteConfirm = false;
    this.deleteConfirmOverlay?.setVisible(false);

    this.playConfirmSound();
    this.updateDisplay();
  }

  /**
   * Update scroll offset based on selection
   */
  updateScrollOffset() {
    // Keep selected item visible
    const halfVisible = Math.floor(this.visibleEntries / 2);

    if (this.selectedIndex < this.scrollOffset + halfVisible) {
      this.scrollOffset = Math.max(0, this.selectedIndex - halfVisible);
    } else if (this.selectedIndex >= this.scrollOffset + this.visibleEntries - halfVisible) {
      this.scrollOffset = Math.min(
        Math.max(0, this.filteredReplays.length - this.visibleEntries),
        this.selectedIndex - this.visibleEntries + halfVisible + 1
      );
    }
  }

  /**
   * Update display
   */
  updateDisplay() {
    const hasReplays = this.filteredReplays.length > 0;

    // Show/hide empty state
    this.emptyStateText?.setVisible(!hasReplays);

    // Update replay list
    this.replayDisplays.forEach((display, i) => {
      const replayIndex = this.scrollOffset + i;
      const replay = this.filteredReplays[replayIndex];

      if (replay) {
        display.setVisible(true);

        const songText = /** @type {Phaser.GameObjects.Text} */ (display.getData('songText'));
        const diffText = /** @type {Phaser.GameObjects.Text} */ (display.getData('diffText'));
        const scoreText = /** @type {Phaser.GameObjects.Text} */ (display.getData('scoreText'));
        const accText = /** @type {Phaser.GameObjects.Text} */ (display.getData('accText'));
        const dateText = /** @type {Phaser.GameObjects.Text} */ (display.getData('dateText'));

        songText.setText(replay.songName || replay.songId);
        diffText.setText(replay.difficulty.toUpperCase());
        scoreText.setText(replay.score.toLocaleString());
        accText.setText(`${replay.accuracy.toFixed(2)}%`);
        dateText.setText(this.formatDate(replay.timestamp));

        // Difficulty color
        /** @type {Record<string, string>} */
        const diffColors = {
          easy: '#00ff00',
          normal: '#ffff00',
          hard: '#ff0000'
        };
        diffText.setColor(diffColors[replay.difficulty] || '#ffffff');

        // Highlight selected
        if (replayIndex === this.selectedIndex) {
          songText.setColor('#ffff00');
          display.setAlpha(1);
        } else {
          songText.setColor('#ffffff');
          display.setAlpha(0.7);
        }
      } else {
        display.setVisible(false);
      }
    });

    // Update info panel
    if (hasReplays) {
      const selected = this.filteredReplays[this.selectedIndex];
      this.infoPanel.songText?.setText(selected.songName || selected.songId);
      this.infoPanel.difficultyText?.setText(selected.difficulty.toUpperCase());
      this.infoPanel.scoreText?.setText(selected.score.toLocaleString());
      this.infoPanel.accuracyText?.setText(`${selected.accuracy.toFixed(2)}%`);
      this.infoPanel.dateText?.setText(this.formatDate(selected.timestamp));

      // Difficulty color
      /** @type {Record<string, string>} */
      const diffColors = {
        easy: '#00ff00',
        normal: '#ffff00',
        hard: '#ff0000'
      };
      this.infoPanel.difficultyText?.setColor(diffColors[selected.difficulty] || '#ffffff');
    } else {
      this.infoPanel.songText?.setText('-');
      this.infoPanel.difficultyText?.setText('-');
      this.infoPanel.scoreText?.setText('-');
      this.infoPanel.accuracyText?.setText('-');
      this.infoPanel.dateText?.setText('-');
    }

    // Update filter text
    if (this.filterText) {
      const filterDisplay = this.songFilter || 'ALL';
      this.filterText.setText(filterDisplay);
    }
  }

  /**
   * Format timestamp to readable date
   * @param {number} timestamp - Unix timestamp
   * @returns {string}
   */
  formatDate(timestamp) {
    const date = new Date(timestamp);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const year = date.getFullYear();
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${month}/${day}/${year} ${hours}:${minutes}`;
  }

  /**
   * Start replay playback
   * @param {ReplayListEntry} replay - Replay to play
   */
  async startReplayPlayback(replay) {
    await this.getTransitions().transitionOut({ type: TransitionType.FADE, duration: 500 });
    if (!this.transitions) {
      return;
    }
    this.scene.start('PlayState', {
      songId: replay.songId,
      difficulty: replay.difficulty,
      replayId: replay.id,
      isReplay: true
    });
  }

  /**
   * Play scroll sound
   */
  playScrollSound() {
    if (this.cache.audio.exists('scroll-sound')) {
      this.sound.play('scroll-sound', { volume: 0.5 });
    }
  }

  /**
   * Play confirm sound
   */
  playConfirmSound() {
    if (this.cache.audio.exists('confirm-sound')) {
      this.sound.play('confirm-sound');
    }
  }

  /**
   * Play cancel sound
   */
  playCancelSound() {
    if (this.cache.audio.exists('cancel-sound')) {
      this.sound.play('cancel-sound');
    }
  }

  /**
   * Update loop
   * @param {number} _time - Time
   * @param {number} _delta - Delta
   */
  update(_time, _delta) {
    // Could add smooth scrolling animation here
  }

  /**
   * Cleanup
   */
  shutdown() {
    this.events?.off('shutdown', this.shutdown, this);
    this.input.keyboard?.off('keydown-UP', this.onNavigateUp, this);
    this.input.keyboard?.off('keydown-DOWN', this.onNavigateDown, this);
    this.input.keyboard?.off('keydown-W', this.onNavigateUp, this);
    this.input.keyboard?.off('keydown-S', this.onNavigateDown, this);
    this.input.keyboard?.off('keydown-LEFT', this.onFilterLeft, this);
    this.input.keyboard?.off('keydown-RIGHT', this.onFilterRight, this);
    this.input.keyboard?.off('keydown-A', this.onFilterLeft, this);
    this.input.keyboard?.off('keydown-D', this.onFilterRight, this);
    this.input.keyboard?.off('keydown-ENTER', this.onSelect, this);
    this.input.keyboard?.off('keydown-SPACE', this.onSelect, this);
    this.input.keyboard?.off('keydown-DELETE', this.onDelete, this);
    this.input.keyboard?.off('keydown-BACKSPACE', this.onDeleteKey, this);
    this.input.keyboard?.off('keydown-ESC', this.onBack, this);

    // Kill all tweens
    if (this.tweens?.killAll) {
      this.tweens.killAll();
    }

    // Tear down the shared Transitions instance (cancels in-flight tween /
    // overlay safely, even mid-transition).
    if (this.transitions) {
      this.transitions.destroy();
      this.transitions = null;
    }

    // Null owned game object references
    this.replayDisplays = [];
    this.allReplays = [];
    this.filteredReplays = [];
    this.replayManager = null;
    this.deleteConfirmOverlay = null;
    this.filterText = null;
    this.emptyStateText = null;
    this.infoPanel = {
      songText: null,
      difficultyText: null,
      scoreText: null,
      accuracyText: null,
      dateText: null
    };
  }
}

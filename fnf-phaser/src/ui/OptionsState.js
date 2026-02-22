/**
 * @fileoverview Options State - Game settings and configuration
 * Implements FR-6.5: Options menu with keybinds, calibration, preferences
 */

import Phaser from 'phaser';
import * as Constants from '../core/Constants.js';

/**
 * Option item types
 * @typedef {'toggle' | 'slider' | 'keybind' | 'action'} OptionType
 */

/**
 * Option item configuration
 * @typedef {Object} OptionItem
 * @property {string} name - Display name
 * @property {string} key - Storage key
 * @property {OptionType} type - Option type
 * @property {*} value - Current value
 * @property {*} [defaultValue] - Default value
 * @property {number} [min] - Min value for sliders
 * @property {number} [max] - Max value for sliders
 * @property {number} [step] - Step value for sliders
 * @property {Function} [action] - Action to perform
 */

/**
 * Option category
 * @typedef {Object} OptionCategory
 * @property {string} name - Category name
 * @property {OptionItem[]} items - Options in category
 */

/**
 * OptionsState - Game settings menu
 * @extends Phaser.Scene
 */
export default class OptionsState extends Phaser.Scene {
  constructor() {
    super({ key: 'OptionsState' });

    /**
     * Option categories
     * @type {OptionCategory[]}
     */
    this.categories = [
      {
        name: 'Gameplay',
        items: [
          { name: 'Downscroll', key: 'downscroll', type: 'toggle', value: false, defaultValue: false },
          { name: 'Ghost Tapping', key: 'ghostTapping', type: 'toggle', value: true, defaultValue: true },
          { name: 'Scroll Speed', key: 'scrollSpeed', type: 'slider', value: 1.0, defaultValue: 1.0, min: 0.5, max: 3.0, step: 0.1 },
          { name: 'Note Offset', key: 'noteOffset', type: 'slider', value: 0, defaultValue: 0, min: -100, max: 100, step: 5 }
        ]
      },
      {
        name: 'Competitive',
        items: [
          { name: 'Input Buffer', key: 'inputBufferWindow', type: 'slider', value: 50, defaultValue: 50, min: 0, max: 100, step: 5 },
          { name: 'Input Delay', key: 'inputDelayCompensation', type: 'slider', value: 0, defaultValue: 0, min: -50, max: 50, step: 1 }
        ]
      },
      {
        name: 'HUD Stats',
        items: [
          { name: 'NPS Meter', key: 'showNPS', type: 'toggle', value: true, defaultValue: true },
          { name: 'Grade Display', key: 'showGrade', type: 'toggle', value: true, defaultValue: true },
          { name: 'Combo Breaks', key: 'showComboBreaks', type: 'toggle', value: true, defaultValue: true },
          { name: 'Judgements', key: 'showJudgements', type: 'toggle', value: false, defaultValue: false }
        ]
      },
      {
        name: 'Audio',
        items: [
          { name: 'Master Volume', key: 'masterVolume', type: 'slider', value: 100, defaultValue: 100, min: 0, max: 100, step: 5 },
          { name: 'Music Volume', key: 'musicVolume', type: 'slider', value: 100, defaultValue: 100, min: 0, max: 100, step: 5 },
          { name: 'SFX Volume', key: 'sfxVolume', type: 'slider', value: 100, defaultValue: 100, min: 0, max: 100, step: 5 },
          { name: 'Hitsounds', key: 'hitsounds', type: 'toggle', value: false, defaultValue: false }
        ]
      },
      {
        name: 'Visuals',
        items: [
          { name: 'Show FPS', key: 'showFps', type: 'toggle', value: false, defaultValue: false },
          { name: 'Flashing Lights', key: 'flashingLights', type: 'toggle', value: true, defaultValue: true },
          { name: 'Camera Zoom', key: 'cameraZoom', type: 'toggle', value: true, defaultValue: true },
          { name: 'Combo Display', key: 'comboDisplay', type: 'toggle', value: true, defaultValue: true }
        ]
      },
      {
        name: 'Controls',
        items: [
          { name: 'Left', key: 'keyLeft', type: 'keybind', value: 'A', defaultValue: 'A' },
          { name: 'Down', key: 'keyDown', type: 'keybind', value: 'S', defaultValue: 'S' },
          { name: 'Up', key: 'keyUp', type: 'keybind', value: 'W', defaultValue: 'W' },
          { name: 'Right', key: 'keyRight', type: 'keybind', value: 'D', defaultValue: 'D' },
          { name: 'Alt Left', key: 'keyLeftAlt', type: 'keybind', value: 'LEFT', defaultValue: 'LEFT' },
          { name: 'Alt Down', key: 'keyDownAlt', type: 'keybind', value: 'DOWN', defaultValue: 'DOWN' },
          { name: 'Alt Up', key: 'keyUpAlt', type: 'keybind', value: 'UP', defaultValue: 'UP' },
          { name: 'Alt Right', key: 'keyRightAlt', type: 'keybind', value: 'RIGHT', defaultValue: 'RIGHT' }
        ]
      },
      {
        name: 'Misc',
        items: [
          { name: 'Offset Calibration', key: 'calibrate', type: 'action', action: 'calibrate' },
          { name: 'Reset to Defaults', key: 'reset', type: 'action', action: 'reset' }
        ]
      }
    ];

    /**
     * Currently selected category index
     * @type {number}
     */
    this.selectedCategoryIndex = 0;

    /**
     * Currently selected item index
     * @type {number}
     */
    this.selectedItemIndex = 0;

    /**
     * Whether in keybind capture mode
     * @type {boolean}
     */
    this.capturingKeybind = false;

    /**
     * Category tabs
     * @type {Phaser.GameObjects.Text[]}
     */
    this.categoryTabs = [];

    /**
     * Option item displays
     * @type {Phaser.GameObjects.Container[]}
     */
    this.optionDisplays = [];

    /**
     * Whether transitioning
     * @type {boolean}
     */
    this.transitioning = false;

    /**
     * Keybind capture text
     * @type {Phaser.GameObjects.Text | null}
     */
    this.keybindCaptureText = null;
  }

  /**
   * Preload assets
   */
  preload() {
    this.load.setPath('assets/');

    if (!this.cache.audio.exists('scroll-sound')) {
      this.load.audio('scroll-sound', 'audio/scrollMenu.mp3');
    }
  }

  /**
   * Create the options menu
   */
  create() {
    this.transitioning = false;
    this.capturingKeybind = false;
    this.selectedCategoryIndex = 0;
    this.selectedItemIndex = 0;

    // Load saved options
    this.loadOptions();

    const { width, height } = this.cameras.main;

    // Background
    this.createBackground();

    // Title
    this.add.text(width / 2, 40, 'OPTIONS', {
      fontFamily: 'Arial Black',
      fontSize: '48px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 4
    }).setOrigin(0.5, 0.5);

    // Category tabs
    this.createCategoryTabs();

    // Option items
    this.createOptionItems();

    // Keybind capture overlay (hidden initially)
    this.createKeybindCaptureOverlay();

    // Instructions
    this.createInstructions();

    // Setup input
    this.setupInput();

    // Update display
    this.updateDisplay();

    // Fade in
    this.cameras.main.fadeIn(500, 0, 0, 0);
  }

  /**
   * Create background
   */
  createBackground() {
    const { width, height } = this.cameras.main;
    const graphics = this.add.graphics();
    graphics.fillGradientStyle(0x1a1a2e, 0x1a1a2e, 0x16213e, 0x16213e, 1);
    graphics.fillRect(0, 0, width, height);
  }

  /**
   * Create category tabs
   */
  createCategoryTabs() {
    const startX = 100;
    const y = 100;
    const spacing = 150;

    this.categoryTabs = [];

    this.categories.forEach((category, index) => {
      const x = startX + index * spacing;
      const text = this.add.text(x, y, category.name, {
        fontFamily: 'Arial',
        fontSize: '24px',
        color: '#ffffff'
      });
      text.setOrigin(0.5, 0.5);
      this.categoryTabs.push(text);
    });
  }

  /**
   * Create option items display
   */
  createOptionItems() {
    const startY = 160;
    const spacing = 50;

    this.optionDisplays = [];

    // Create containers for max items
    for (let i = 0; i < 10; i++) {
      const container = this.createOptionDisplay(100, startY + i * spacing);
      this.optionDisplays.push(container);
    }
  }

  /**
   * Create a single option display
   * @param {number} x - X position
   * @param {number} y - Y position
   * @returns {Phaser.GameObjects.Container}
   */
  createOptionDisplay(x, y) {
    const { width } = this.cameras.main;
    const container = this.add.container(x, y);

    // Name text
    const nameText = this.add.text(0, 0, '', {
      fontFamily: 'Arial',
      fontSize: '24px',
      color: '#ffffff'
    });
    container.add(nameText);
    container.setData('nameText', nameText);

    // Value text/display
    const valueText = this.add.text(width - 300, 0, '', {
      fontFamily: 'Arial',
      fontSize: '24px',
      color: '#00ff00'
    });
    container.add(valueText);
    container.setData('valueText', valueText);

    // Slider bar (for slider type)
    const sliderBg = this.add.graphics();
    sliderBg.fillStyle(0x333333, 1);
    sliderBg.fillRect(width - 500, 5, 200, 20);
    container.add(sliderBg);
    container.setData('sliderBg', sliderBg);

    const sliderFill = this.add.graphics();
    container.add(sliderFill);
    container.setData('sliderFill', sliderFill);

    return container;
  }

  /**
   * Create keybind capture overlay
   */
  createKeybindCaptureOverlay() {
    const { width, height } = this.cameras.main;

    this.keybindOverlay = this.add.container(0, 0);
    this.keybindOverlay.setVisible(false);

    // Darken background
    const bg = this.add.graphics();
    bg.fillStyle(0x000000, 0.8);
    bg.fillRect(0, 0, width, height);
    this.keybindOverlay.add(bg);

    // Prompt text
    this.keybindCaptureText = this.add.text(width / 2, height / 2, 'Press any key...', {
      fontFamily: 'Arial Black',
      fontSize: '48px',
      color: '#ffffff'
    }).setOrigin(0.5, 0.5);
    this.keybindOverlay.add(this.keybindCaptureText);

    // Cancel hint
    const cancelText = this.add.text(width / 2, height / 2 + 60, 'Press ESC to cancel', {
      fontFamily: 'Arial',
      fontSize: '24px',
      color: '#888888'
    }).setOrigin(0.5, 0.5);
    this.keybindOverlay.add(cancelText);
  }

  /**
   * Create instructions
   */
  createInstructions() {
    const { width, height } = this.cameras.main;

    this.add.text(width / 2, height - 40, 'Arrow Keys: Navigate | Enter: Select/Change | ESC: Back', {
      fontFamily: 'Arial',
      fontSize: '18px',
      color: '#888888'
    }).setOrigin(0.5, 0.5);
  }

  /**
   * Setup input
   */
  setupInput() {
    // Navigation
    this.input.keyboard.on('keydown-UP', this.onNavigateUp, this);
    this.input.keyboard.on('keydown-DOWN', this.onNavigateDown, this);
    this.input.keyboard.on('keydown-LEFT', this.onNavigateLeft, this);
    this.input.keyboard.on('keydown-RIGHT', this.onNavigateRight, this);

    // Selection/Change
    this.input.keyboard.on('keydown-ENTER', this.onSelect, this);
    this.input.keyboard.on('keydown-SPACE', this.onSelect, this);

    // Back
    this.input.keyboard.on('keydown-ESC', this.onBack, this);
    this.input.keyboard.on('keydown-BACKSPACE', this.onBack, this);

    // Keybind capture (any key)
    this.input.keyboard.on('keydown', this.onAnyKeyDown, this);
  }

  /**
   * Navigate up
   */
  onNavigateUp() {
    if (this.transitioning || this.capturingKeybind) return;

    const category = this.categories[this.selectedCategoryIndex];
    this.selectedItemIndex--;
    if (this.selectedItemIndex < 0) {
      this.selectedItemIndex = category.items.length - 1;
    }

    this.playScrollSound();
    this.updateDisplay();
  }

  /**
   * Navigate down
   */
  onNavigateDown() {
    if (this.transitioning || this.capturingKeybind) return;

    const category = this.categories[this.selectedCategoryIndex];
    this.selectedItemIndex++;
    if (this.selectedItemIndex >= category.items.length) {
      this.selectedItemIndex = 0;
    }

    this.playScrollSound();
    this.updateDisplay();
  }

  /**
   * Navigate left (change category or value)
   */
  onNavigateLeft() {
    if (this.transitioning || this.capturingKeybind) return;

    const category = this.categories[this.selectedCategoryIndex];
    const item = category.items[this.selectedItemIndex];

    if (item.type === 'slider') {
      item.value = Math.max(item.min, item.value - item.step);
      this.saveOptions();
      this.updateDisplay();
    } else {
      // Change category
      this.selectedCategoryIndex--;
      if (this.selectedCategoryIndex < 0) {
        this.selectedCategoryIndex = this.categories.length - 1;
      }
      this.selectedItemIndex = 0;
      this.playScrollSound();
      this.updateDisplay();
    }
  }

  /**
   * Navigate right (change category or value)
   */
  onNavigateRight() {
    if (this.transitioning || this.capturingKeybind) return;

    const category = this.categories[this.selectedCategoryIndex];
    const item = category.items[this.selectedItemIndex];

    if (item.type === 'slider') {
      item.value = Math.min(item.max, item.value + item.step);
      this.saveOptions();
      this.updateDisplay();
    } else {
      // Change category
      this.selectedCategoryIndex++;
      if (this.selectedCategoryIndex >= this.categories.length) {
        this.selectedCategoryIndex = 0;
      }
      this.selectedItemIndex = 0;
      this.playScrollSound();
      this.updateDisplay();
    }
  }

  /**
   * Select/toggle current option
   */
  onSelect() {
    if (this.transitioning || this.capturingKeybind) return;

    const category = this.categories[this.selectedCategoryIndex];
    const item = category.items[this.selectedItemIndex];

    switch (item.type) {
      case 'toggle':
        item.value = !item.value;
        this.saveOptions();
        this.updateDisplay();
        break;

      case 'keybind':
        this.startKeybindCapture(item);
        break;

      case 'action':
        this.executeAction(item.action);
        break;
    }
  }

  /**
   * Go back
   */
  onBack() {
    if (this.capturingKeybind) {
      this.cancelKeybindCapture();
      return;
    }

    if (this.transitioning) return;

    this.transitioning = true;
    this.saveOptions();

    this.cameras.main.fadeOut(500, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('MainMenuState');
    });
  }

  /**
   * Handle any key press (for keybind capture)
   * @param {KeyboardEvent} event - Keyboard event
   */
  onAnyKeyDown(event) {
    if (!this.capturingKeybind) return;

    const key = event.key.toUpperCase();

    // Ignore ESC (handled by onBack)
    if (key === 'ESCAPE') return;

    // Set the keybind
    this.captureKeybindItem.value = key;
    this.saveOptions();
    this.cancelKeybindCapture();
    this.updateDisplay();
  }

  /**
   * Start keybind capture mode
   * @param {OptionItem} item - Keybind item
   */
  startKeybindCapture(item) {
    this.capturingKeybind = true;
    this.captureKeybindItem = item;
    this.keybindOverlay.setVisible(true);
    this.keybindCaptureText.setText(`Press key for: ${item.name}`);
  }

  /**
   * Cancel keybind capture
   */
  cancelKeybindCapture() {
    this.capturingKeybind = false;
    this.captureKeybindItem = null;
    this.keybindOverlay.setVisible(false);
  }

  /**
   * Execute an action
   * @param {string} action - Action name
   */
  executeAction(action) {
    switch (action) {
      case 'calibrate':
        // Would transition to calibration scene
        console.log('Starting offset calibration...');
        break;

      case 'reset':
        this.resetToDefaults();
        break;
    }
  }

  /**
   * Reset all options to defaults
   */
  resetToDefaults() {
    this.categories.forEach(category => {
      category.items.forEach(item => {
        if (item.defaultValue !== undefined) {
          item.value = item.defaultValue;
        }
      });
    });

    this.saveOptions();
    this.updateDisplay();
  }

  /**
   * Update display
   */
  updateDisplay() {
    // Update category tabs
    this.categoryTabs.forEach((tab, index) => {
      if (index === this.selectedCategoryIndex) {
        tab.setColor('#ffff00');
        tab.setScale(1.1);
      } else {
        tab.setColor('#ffffff');
        tab.setScale(1.0);
      }
    });

    // Update option items
    const category = this.categories[this.selectedCategoryIndex];
    const { width } = this.cameras.main;

    this.optionDisplays.forEach((display, index) => {
      const item = category.items[index];

      if (item) {
        display.setVisible(true);

        const nameText = display.getData('nameText');
        const valueText = display.getData('valueText');
        const sliderBg = display.getData('sliderBg');
        const sliderFill = display.getData('sliderFill');

        nameText.setText(item.name);

        // Highlight selected
        if (index === this.selectedItemIndex) {
          nameText.setColor('#ffff00');
        } else {
          nameText.setColor('#ffffff');
        }

        // Update value display based on type
        switch (item.type) {
          case 'toggle':
            valueText.setText(item.value ? 'ON' : 'OFF');
            valueText.setColor(item.value ? '#00ff00' : '#ff0000');
            sliderBg.setVisible(false);
            sliderFill.setVisible(false);
            break;

          case 'slider':
            valueText.setText(`${item.value}`);
            valueText.setColor('#ffffff');
            sliderBg.setVisible(true);
            sliderFill.setVisible(true);

            // Update slider fill
            sliderFill.clear();
            sliderFill.fillStyle(0x00ff00, 1);
            const fillWidth = ((item.value - item.min) / (item.max - item.min)) * 200;
            sliderFill.fillRect(width - 500, 5, fillWidth, 20);
            break;

          case 'keybind':
            valueText.setText(item.value);
            valueText.setColor('#00ffff');
            sliderBg.setVisible(false);
            sliderFill.setVisible(false);
            break;

          case 'action':
            valueText.setText('');
            sliderBg.setVisible(false);
            sliderFill.setVisible(false);
            break;
        }
      } else {
        display.setVisible(false);
      }
    });
  }

  /**
   * Load options from localStorage
   */
  loadOptions() {
    try {
      const saved = localStorage.getItem('fnf-options');
      if (saved) {
        const data = JSON.parse(saved);
        this.categories.forEach(category => {
          category.items.forEach(item => {
            if (data[item.key] !== undefined) {
              item.value = data[item.key];
            }
          });
        });
      }
    } catch (e) {
      console.warn('Failed to load options:', e);
    }
  }

  /**
   * Save options to localStorage
   */
  saveOptions() {
    try {
      const data = {};
      this.categories.forEach(category => {
        category.items.forEach(item => {
          if (item.type !== 'action') {
            data[item.key] = item.value;
          }
        });
      });
      localStorage.setItem('fnf-options', JSON.stringify(data));
    } catch (e) {
      console.warn('Failed to save options:', e);
    }
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
   * Cleanup
   */
  shutdown() {
    this.input.keyboard.off('keydown-UP', this.onNavigateUp, this);
    this.input.keyboard.off('keydown-DOWN', this.onNavigateDown, this);
    this.input.keyboard.off('keydown-LEFT', this.onNavigateLeft, this);
    this.input.keyboard.off('keydown-RIGHT', this.onNavigateRight, this);
    this.input.keyboard.off('keydown-ENTER', this.onSelect, this);
    this.input.keyboard.off('keydown-SPACE', this.onSelect, this);
    this.input.keyboard.off('keydown-ESC', this.onBack, this);
    this.input.keyboard.off('keydown-BACKSPACE', this.onBack, this);
    this.input.keyboard.off('keydown', this.onAnyKeyDown, this);

    this.categoryTabs = [];
    this.optionDisplays = [];
  }
}

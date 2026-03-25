/**
 * @fileoverview Options State - Game settings and configuration
 * Implements FR-6.5: Options menu with keybinds, calibration, preferences
 */

import BaseMenuState from './BaseMenuState.js';

/**
 * @typedef {'toggle' | 'slider' | 'keybind' | 'action'} OptionType
 */

/**
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
 * @typedef {Object} OptionCategory
 * @property {string} name - Category name
 * @property {OptionItem[]} items - Options in category
 */

/**
 * OptionsState - Game settings menu
 * @extends BaseMenuState
 */
export default class OptionsState extends BaseMenuState {
  constructor() {
    super({ key: 'OptionsState' });

    /** @type {OptionCategory[]} */
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

    /** @type {number} */
    this.selectedCategoryIndex = 0;
    /** @type {boolean} */
    this.capturingKeybind = false;
    /** @type {Phaser.GameObjects.Text[]} */
    this.categoryTabs = [];
    /** @type {Phaser.GameObjects.Container[]} */
    this.optionDisplays = [];
    /** @type {Phaser.GameObjects.Text | null} */
    this.keybindCaptureText = null;
  }

  /**
   * Alias for selectedIndex — preserves the public API that tests and
   * other code use (`scene.selectedItemIndex`).
   */
  get selectedItemIndex() {
    return this.selectedIndex;
  }

  set selectedItemIndex(value) {
    this.selectedIndex = value;
  }

  // ========================================
  // BASEMENUSTATE OVERRIDES
  // ========================================

  /** @override */
  getItemCount() {
    return this.categories[this.selectedCategoryIndex].items.length;
  }

  /** @override */
  updateSelection() {
    this.updateDisplay();
  }

  /** @override */
  executeSelection() {
    // Not used — OptionsState has custom onSelect logic
  }

  /** @override */
  executeBack() {
    this.saveOptions();
    this.transitionToScene('MainMenuState');
  }

  /** @override - OptionsState needs extra bindings for LEFT/RIGHT and keydown */
  getInputBindings() {
    return [
      ...super.getInputBindings(),
      { key: 'keydown-LEFT', handler: this.onNavigateLeft },
      { key: 'keydown-RIGHT', handler: this.onNavigateRight },
      { key: 'keydown', handler: this.onAnyKeyDown }
    ];
  }

  // ========================================
  // CUSTOM NAVIGATION (capturingKeybind guard)
  // ========================================

  /**
   * OptionsState overrides base navigation because it has an additional
   * `capturingKeybind` guard that the base class doesn't know about.
   * @override
   */
  onNavigateUp() {
    if (this.transitioning || this.capturingKeybind) return;
    const category = this.categories[this.selectedCategoryIndex];
    this.selectedIndex = (this.selectedIndex - 1 + category.items.length) % category.items.length;
    this.playScrollSound();
    this.updateDisplay();
  }

  /** @override */
  onNavigateDown() {
    if (this.transitioning || this.capturingKeybind) return;
    const category = this.categories[this.selectedCategoryIndex];
    this.selectedIndex = (this.selectedIndex + 1) % category.items.length;
    this.playScrollSound();
    this.updateDisplay();
  }

  onNavigateLeft() {
    if (this.transitioning || this.capturingKeybind) return;
    const item = this.categories[this.selectedCategoryIndex].items[this.selectedIndex];

    if (item.type === 'slider') {
      item.value = Math.max(item.min, item.value - item.step);
      this.saveOptions();
      this.updateDisplay();
    } else {
      this.selectedCategoryIndex--;
      if (this.selectedCategoryIndex < 0) this.selectedCategoryIndex = this.categories.length - 1;
      this.selectedIndex = 0;
      this.playScrollSound();
      this.updateDisplay();
    }
  }

  onNavigateRight() {
    if (this.transitioning || this.capturingKeybind) return;
    const item = this.categories[this.selectedCategoryIndex].items[this.selectedIndex];

    if (item.type === 'slider') {
      item.value = Math.min(item.max, item.value + item.step);
      this.saveOptions();
      this.updateDisplay();
    } else {
      this.selectedCategoryIndex++;
      if (this.selectedCategoryIndex >= this.categories.length) this.selectedCategoryIndex = 0;
      this.selectedIndex = 0;
      this.playScrollSound();
      this.updateDisplay();
    }
  }

  /**
   * OptionsState has custom select logic — toggles, keybind capture,
   * and actions don't use the base transition guard pattern.
   * @override
   */
  onSelect() {
    if (this.transitioning || this.capturingKeybind) return;
    const item = this.categories[this.selectedCategoryIndex].items[this.selectedIndex];

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
   * OptionsState has custom back logic — keybind cancel takes priority.
   * @override
   */
  onBack() {
    if (this.capturingKeybind) {
      this.cancelKeybindCapture();
      return;
    }
    if (this.transitioning) return;
    this.transitioning = true;
    this.playCancelSound();
    this.executeBack();
  }

  // ========================================
  // LIFECYCLE
  // ========================================

  preload() {
    this.load.setPath('assets/');
    this.preloadMenuSounds();
  }

  create() {
    this.transitioning = false;
    this.capturingKeybind = false;
    this.selectedCategoryIndex = 0;
    this.selectedIndex = 0;

    this.loadOptions();

    const { width, height } = this.cameras.main;

    this.createBackground(null);

    this.add.text(width / 2, 40, 'OPTIONS', {
      fontFamily: 'Arial Black', fontSize: '48px', color: '#ffffff',
      stroke: '#000000', strokeThickness: 4
    }).setOrigin(0.5, 0.5);

    this.createCategoryTabs();
    this.createOptionItems();
    this.createKeybindCaptureOverlay();
    this.createInstructions();
    this.setupInput();
    this.updateDisplay();
    this.fadeIn();
  }

  createCategoryTabs() {
    this.categoryTabs = [];
    this.categories.forEach((category, index) => {
      const text = this.add.text(100 + index * 150, 100, category.name, {
        fontFamily: 'Arial', fontSize: '24px', color: '#ffffff'
      }).setOrigin(0.5, 0.5);
      this.categoryTabs.push(text);
    });
  }

  createOptionItems() {
    this.optionDisplays = [];
    for (let i = 0; i < 10; i++) {
      const container = this.createOptionDisplay(100, 160 + i * 50);
      this.optionDisplays.push(container);
    }
  }

  createOptionDisplay(x, y) {
    const { width } = this.cameras.main;
    const container = this.add.container(x, y);

    const nameText = this.add.text(0, 0, '', { fontFamily: 'Arial', fontSize: '24px', color: '#ffffff' });
    container.add(nameText);
    container.setData('nameText', nameText);

    const valueText = this.add.text(width - 300, 0, '', { fontFamily: 'Arial', fontSize: '24px', color: '#00ff00' });
    container.add(valueText);
    container.setData('valueText', valueText);

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

  createKeybindCaptureOverlay() {
    const { width, height } = this.cameras.main;

    this.keybindOverlay = this.add.container(0, 0);
    this.keybindOverlay.setVisible(false);

    const bg = this.add.graphics();
    bg.fillStyle(0x000000, 0.8);
    bg.fillRect(0, 0, width, height);
    this.keybindOverlay.add(bg);

    this.keybindCaptureText = this.add.text(width / 2, height / 2, 'Press any key...', {
      fontFamily: 'Arial Black', fontSize: '48px', color: '#ffffff'
    }).setOrigin(0.5, 0.5);
    this.keybindOverlay.add(this.keybindCaptureText);

    const cancelText = this.add.text(width / 2, height / 2 + 60, 'Press ESC to cancel', {
      fontFamily: 'Arial', fontSize: '24px', color: '#888888'
    }).setOrigin(0.5, 0.5);
    this.keybindOverlay.add(cancelText);
  }

  createInstructions() {
    const { width, height } = this.cameras.main;
    this.add.text(width / 2, height - 40, 'Arrow Keys: Navigate | Enter: Select/Change | ESC: Back', {
      fontFamily: 'Arial', fontSize: '18px', color: '#888888'
    }).setOrigin(0.5, 0.5);
  }

  // ========================================
  // KEYBIND CAPTURE
  // ========================================

  onAnyKeyDown(event) {
    if (!this.capturingKeybind) return;
    const key = event.key.toUpperCase();
    if (key === 'ESCAPE') return;
    this.captureKeybindItem.value = key;
    this.saveOptions();
    this.cancelKeybindCapture();
    this.updateDisplay();
  }

  startKeybindCapture(item) {
    this.capturingKeybind = true;
    this.captureKeybindItem = item;
    this.keybindOverlay.setVisible(true);
    this.keybindCaptureText.setText(`Press key for: ${item.name}`);
  }

  cancelKeybindCapture() {
    this.capturingKeybind = false;
    this.captureKeybindItem = null;
    this.keybindOverlay.setVisible(false);
  }

  // ========================================
  // ACTIONS
  // ========================================

  executeAction(action) {
    switch (action) {
      case 'calibrate':
        console.log('Starting offset calibration...');
        break;
      case 'reset':
        this.resetToDefaults();
        break;
    }
  }

  resetToDefaults() {
    this.categories.forEach(category => {
      category.items.forEach(item => {
        if (item.defaultValue !== undefined) item.value = item.defaultValue;
      });
    });
    this.saveOptions();
    this.updateDisplay();
  }

  // ========================================
  // DISPLAY
  // ========================================

  updateDisplay() {
    this.categoryTabs.forEach((tab, index) => {
      tab.setColor(index === this.selectedCategoryIndex ? '#ffff00' : '#ffffff');
      tab.setScale(index === this.selectedCategoryIndex ? 1.1 : 1.0);
    });

    const category = this.categories[this.selectedCategoryIndex];
    const { width } = this.cameras.main;

    this.optionDisplays.forEach((display, index) => {
      const item = category.items[index];
      if (!item) { display.setVisible(false); return; }

      display.setVisible(true);
      const nameText = display.getData('nameText');
      const valueText = display.getData('valueText');
      const sliderBg = display.getData('sliderBg');
      const sliderFill = display.getData('sliderFill');

      nameText.setText(item.name);
      nameText.setColor(index === this.selectedIndex ? '#ffff00' : '#ffffff');

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
          sliderFill.clear();
          sliderFill.fillStyle(0x00ff00, 1);
          sliderFill.fillRect(width - 500, 5, ((item.value - item.min) / (item.max - item.min)) * 200, 20);
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
    });
  }

  // ========================================
  // PERSISTENCE
  // ========================================

  loadOptions() {
    try {
      const saved = localStorage.getItem('fnf-options');
      if (saved) {
        const data = JSON.parse(saved);
        this.categories.forEach(category => {
          category.items.forEach(item => {
            if (data[item.key] !== undefined) item.value = data[item.key];
          });
        });
      }
    } catch (e) {
      console.warn('Failed to load options:', e);
    }
  }

  saveOptions() {
    try {
      const data = {};
      this.categories.forEach(category => {
        category.items.forEach(item => {
          if (item.type !== 'action') data[item.key] = item.value;
        });
      });
      localStorage.setItem('fnf-options', JSON.stringify(data));
    } catch (e) {
      console.warn('Failed to save options:', e);
    }
  }

  shutdown() {
    super.shutdown();
    this.categoryTabs = [];
    this.optionDisplays = [];
  }
}

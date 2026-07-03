/**
 * @fileoverview Options State - Game settings and configuration
 * Implements FR-6.5: Options menu with keybinds, calibration, preferences
 */

import Phaser from '../phaser.js';
import BaseMenuState from './BaseMenuState.js';
import SaveManager from '../data/SaveManager.js';
import { codeToStoredKey } from '../input/KeybindStorage.js';

/**
 * Description hints for each option, keyed by the option's storage key.
 * Displayed below the option name in the UI.
 * @type {Record<string, string>}
 */
const OPTION_DESCRIPTIONS = {
  downscroll: 'Notes scroll from top to bottom instead of bottom to top',
  ghostTapping: 'Allow pressing keys when no notes are present without penalty',
  scrollSpeed: 'Speed multiplier for note scrolling (0.5x - 3.0x)',
  noteOffset: 'Adjust note timing offset in milliseconds (-100 to +100)',
  inputBufferWindow: 'Input buffer window in milliseconds for late inputs',
  inputDelayCompensation: 'Compensate for input delay in milliseconds',
  showNPS: 'Show notes per second meter during gameplay',
  showGrade: 'Show letter grade during gameplay',
  showComboBreaks: 'Show combo break counter during gameplay',
  showJudgements: 'Show judgement counters (Sick, Good, Bad, etc.)',
  masterVolume: 'Overall game volume',
  musicVolume: 'Volume for music and instrumentals',
  sfxVolume: 'Volume for sound effects and hitsounds',
  hitsounds: 'Play a sound on perfectly timed note hits',
  showFps: 'Show frames per second counter',
  flashingLights: 'Enable flashing light effects during gameplay',
  cameraZoom: 'Enable camera zoom effects on beat',
  comboDisplay: 'Show combo popup on note hits'
};

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
 * @property {string} [action] - Action to perform
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
          {
            name: 'Downscroll',
            key: 'downscroll',
            type: 'toggle',
            value: false,
            defaultValue: false
          },
          {
            name: 'Ghost Tapping',
            key: 'ghostTapping',
            type: 'toggle',
            value: true,
            defaultValue: true
          },
          {
            name: 'Scroll Speed',
            key: 'scrollSpeed',
            type: 'slider',
            value: 1.0,
            defaultValue: 1.0,
            min: 0.5,
            max: 3.0,
            step: 0.1
          },
          {
            name: 'Note Offset',
            key: 'noteOffset',
            type: 'slider',
            value: 0,
            defaultValue: 0,
            min: -100,
            max: 100,
            step: 5
          }
        ]
      },
      {
        name: 'Competitive',
        items: [
          {
            name: 'Input Buffer',
            key: 'inputBufferWindow',
            type: 'slider',
            value: 50,
            defaultValue: 50,
            min: 0,
            max: 100,
            step: 5
          },
          {
            name: 'Input Delay',
            key: 'inputDelayCompensation',
            type: 'slider',
            value: 0,
            defaultValue: 0,
            min: -50,
            max: 50,
            step: 1
          }
        ]
      },
      {
        name: 'HUD Stats',
        items: [
          { name: 'NPS Meter', key: 'showNPS', type: 'toggle', value: true, defaultValue: true },
          {
            name: 'Grade Display',
            key: 'showGrade',
            type: 'toggle',
            value: true,
            defaultValue: true
          },
          {
            name: 'Combo Breaks',
            key: 'showComboBreaks',
            type: 'toggle',
            value: true,
            defaultValue: true
          },
          {
            name: 'Judgements',
            key: 'showJudgements',
            type: 'toggle',
            value: false,
            defaultValue: false
          }
        ]
      },
      {
        name: 'Audio',
        items: [
          {
            name: 'Master Volume',
            key: 'masterVolume',
            type: 'slider',
            value: 100,
            defaultValue: 100,
            min: 0,
            max: 100,
            step: 5
          },
          {
            name: 'Music Volume',
            key: 'musicVolume',
            type: 'slider',
            value: 100,
            defaultValue: 100,
            min: 0,
            max: 100,
            step: 5
          },
          {
            name: 'SFX Volume',
            key: 'sfxVolume',
            type: 'slider',
            value: 100,
            defaultValue: 100,
            min: 0,
            max: 100,
            step: 5
          },
          { name: 'Hitsounds', key: 'hitsounds', type: 'toggle', value: false, defaultValue: false }
        ]
      },
      {
        name: 'Visuals',
        items: [
          { name: 'Show FPS', key: 'showFps', type: 'toggle', value: false, defaultValue: false },
          {
            name: 'Flashing Lights',
            key: 'flashingLights',
            type: 'toggle',
            value: true,
            defaultValue: true
          },
          {
            name: 'Camera Zoom',
            key: 'cameraZoom',
            type: 'toggle',
            value: true,
            defaultValue: true
          },
          {
            name: 'Combo Display',
            key: 'comboDisplay',
            type: 'toggle',
            value: true,
            defaultValue: true
          }
        ]
      },
      {
        name: 'Controls',
        items: [
          { name: 'Left', key: 'keyLeft', type: 'keybind', value: 'A', defaultValue: 'A' },
          { name: 'Down', key: 'keyDown', type: 'keybind', value: 'S', defaultValue: 'S' },
          { name: 'Up', key: 'keyUp', type: 'keybind', value: 'W', defaultValue: 'W' },
          { name: 'Right', key: 'keyRight', type: 'keybind', value: 'D', defaultValue: 'D' },
          {
            name: 'Alt Left',
            key: 'keyLeftAlt',
            type: 'keybind',
            value: 'LEFT',
            defaultValue: 'LEFT'
          },
          {
            name: 'Alt Down',
            key: 'keyDownAlt',
            type: 'keybind',
            value: 'DOWN',
            defaultValue: 'DOWN'
          },
          { name: 'Alt Up', key: 'keyUpAlt', type: 'keybind', value: 'UP', defaultValue: 'UP' },
          {
            name: 'Alt Right',
            key: 'keyRightAlt',
            type: 'keybind',
            value: 'RIGHT',
            defaultValue: 'RIGHT'
          }
        ]
      },
      {
        name: 'Misc',
        items: [
          {
            name: 'Offset Calibration',
            key: 'calibrate',
            type: 'action',
            action: 'calibrate',
            value: null
          },
          { name: 'Reset to Defaults', key: 'reset', type: 'action', action: 'reset', value: null }
        ]
      }
    ];

    /** @type {number} */
    this.selectedCategoryIndex = 0;
    /** @type {boolean} */
    this.capturingKeybind = false;
    /** @type {boolean} */
    this.editingSlider = false;
    /** @type {Phaser.GameObjects.Text[]} */
    this.categoryTabs = [];
    /** @type {Phaser.GameObjects.Container[]} */
    this.optionDisplays = [];
    /** @type {Phaser.GameObjects.Text | null} */
    this.keybindCaptureText = null;
    this.saveManager = SaveManager.getInstance();

    /**
     * Back button
     * @type {Phaser.GameObjects.Text | null}
     */
    this.backButton = null;

    /**
     * Category label
     * @type {Phaser.GameObjects.Text | null}
     */
    this.categoryLabel = null;

    /**
     * Previous category button
     * @type {Phaser.GameObjects.Text | null}
     */
    this.prevCatButton = null;

    /**
     * Next category button
     * @type {Phaser.GameObjects.Text | null}
     */
    this.nextCatButton = null;

    /**
     * Keybind overlay container
     * @type {Phaser.GameObjects.Container | null}
     */
    this.keybindOverlay = null;

    /**
     * Currently capturing keybind item
     * @type {OptionItem | null}
     */
    this.captureKeybindItem = null;

    /**
     * Index of slider being dragged (-1 = none)
     * @type {number}
     */
    this._draggingSliderIndex = -1;
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
    if (this.transitioning || this.capturingKeybind) {
      return;
    }
    this.editingSlider = false;
    const category = this.categories[this.selectedCategoryIndex];
    this.selectedIndex = (this.selectedIndex - 1 + category.items.length) % category.items.length;
    this.playScrollSound();
    this.updateDisplay();
  }

  /** @override */
  onNavigateDown() {
    if (this.transitioning || this.capturingKeybind) {
      return;
    }
    this.editingSlider = false;
    const category = this.categories[this.selectedCategoryIndex];
    this.selectedIndex = (this.selectedIndex + 1) % category.items.length;
    this.playScrollSound();
    this.updateDisplay();
  }

  onNavigateLeft() {
    if (this.transitioning || this.capturingKeybind) {
      return;
    }

    // When actively editing a slider, left/right adjust the value
    if (this.editingSlider) {
      const item = this.categories[this.selectedCategoryIndex].items[this.selectedIndex];
      item.value = Math.round((item.value - (item.step || 1)) * 1000) / 1000;
      item.value = Math.max(item.min || 0, item.value);
      this.saveOptions();
      if (item.key === 'masterVolume' || item.key === 'musicVolume' || item.key === 'sfxVolume') {
        this._applyLiveVolumePreview();
      }
      this.updateDisplay();
      return;
    }

    // Otherwise, always switch tabs
    this.selectedCategoryIndex--;
    if (this.selectedCategoryIndex < 0) {
      this.selectedCategoryIndex = this.categories.length - 1;
    }
    this.selectedIndex = 0;
    this.playScrollSound();
    this.updateDisplay();
  }

  onNavigateRight() {
    if (this.transitioning || this.capturingKeybind) {
      return;
    }

    // When actively editing a slider, left/right adjust the value
    if (this.editingSlider) {
      const item = this.categories[this.selectedCategoryIndex].items[this.selectedIndex];
      item.value = Math.round((item.value + (item.step || 1)) * 1000) / 1000;
      item.value = Math.min(item.max || 100, item.value);
      this.saveOptions();
      if (item.key === 'masterVolume' || item.key === 'musicVolume' || item.key === 'sfxVolume') {
        this._applyLiveVolumePreview();
      }
      this.updateDisplay();
      return;
    }

    // Otherwise, always switch tabs
    this.selectedCategoryIndex++;
    if (this.selectedCategoryIndex >= this.categories.length) {
      this.selectedCategoryIndex = 0;
    }
    this.selectedIndex = 0;
    this.playScrollSound();
    this.updateDisplay();
  }

  /**
   * OptionsState has custom select logic — toggles, keybind capture,
   * and actions don't use the base transition guard pattern.
   * @override
   */
  onSelect() {
    if (this.transitioning || this.capturingKeybind) {
      return;
    }
    const item = this.categories[this.selectedCategoryIndex].items[this.selectedIndex];

    switch (item.type) {
      case 'toggle':
        item.value = !item.value;
        this.saveOptions();
        this.updateDisplay();
        break;
      case 'slider':
        // Toggle slider editing mode
        this.editingSlider = !this.editingSlider;
        this.updateDisplay();
        break;
      case 'keybind':
        this.startKeybindCapture(item);
        break;
      case 'action':
        this.executeAction(item.action ?? '');
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
    if (this.editingSlider) {
      this.editingSlider = false;
      this.updateDisplay();
      return;
    }
    if (this.transitioning) {
      return;
    }
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
    this.editingSlider = false;
    this.selectedCategoryIndex = 0;
    this.selectedIndex = 0;
    this._draggingSliderIndex = -1;

    this.loadOptions();

    const { width } = this.cameras.main;
    const pad = 36;

    this.createBackground(undefined);

    // ── Header row: ← Back ... OPTIONS ──
    this.backButton = this.add
      .text(pad, 50, '← Back', {
        fontFamily: 'Arial',
        fontSize: '32px',
        color: '#94a3b8'
      })
      .setOrigin(0, 0.5)
      .setInteractive({ useHandCursor: true });
    this.backButton.on('pointerdown', () => this.onBack());

    this.add
      .text(width / 2, 50, 'OPTIONS', {
        fontFamily: 'Arial Black',
        fontSize: '42px',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 4
      })
      .setOrigin(0.5, 0.5);

    // ── Category selector row: ◀  Category Name  ▶ ──
    this.prevCatButton = this.add
      .text(pad, 130, '◀', { fontFamily: 'Arial', fontSize: '44px', color: '#7dd3fc' })
      .setOrigin(0, 0.5)
      .setInteractive({ useHandCursor: true });
    this.prevCatButton.on('pointerdown', () => this.onNavigateLeft());

    this.categoryLabel = this.add
      .text(width / 2, 130, '', {
        fontFamily: 'Arial Black',
        fontSize: '36px',
        color: '#facc15'
      })
      .setOrigin(0.5, 0.5);

    this.nextCatButton = this.add
      .text(width - pad, 130, '▶', { fontFamily: 'Arial', fontSize: '44px', color: '#7dd3fc' })
      .setOrigin(1, 0.5)
      .setInteractive({ useHandCursor: true });
    this.nextCatButton.on('pointerdown', () => this.onNavigateRight());

    // ── Option items ──
    this.createOptionItems();
    this.createKeybindCaptureOverlay();
    this.setupInput();
    this.updateDisplay();
    this.fadeIn();
    this.enableTouchOnOptionItems();
  }

  createCategoryTabs() {
    // Category tabs replaced by ◀ / ▶ navigation — no tab objects needed
    this.categoryTabs = [];
  }

  createOptionItems() {
    this.optionDisplays = [];
    const pad = 36;
    const startY = 200;
    const rowHeight = 130;

    for (let i = 0; i < 10; i++) {
      const container = this.createOptionDisplay(pad, startY + i * rowHeight);
      this.optionDisplays.push(container);
    }
  }

  /**
   * @param {number} x
   * @param {number} y
   * @returns {Phaser.GameObjects.Container}
   */
  createOptionDisplay(x, y) {
    const { width } = this.cameras.main;
    const container = this.add.container(x, y);
    const usableWidth = width - 72;

    const nameText = this.add.text(0, 0, '', {
      fontFamily: 'Arial',
      fontSize: '30px',
      color: '#ffffff'
    });
    container.add(nameText);
    container.setData('nameText', nameText);

    const valueText = this.add
      .text(usableWidth, 0, '', {
        fontFamily: 'Arial',
        fontSize: '30px',
        color: '#00ff00'
      })
      .setOrigin(1, 0);
    container.add(valueText);
    container.setData('valueText', valueText);

    const descText = this.add.text(0, 32, '', {
      fontFamily: 'Arial',
      fontSize: '20px',
      color: '#94a3b8',
      wordWrap: { width: usableWidth }
    });
    container.add(descText);
    container.setData('descText', descText);

    // Slider track — full width, tall for easy finger dragging
    const sliderTrackWidth = usableWidth;
    const sliderBg = this.add.graphics();
    sliderBg.fillStyle(0x333333, 1);
    sliderBg.fillRect(0, 48, sliderTrackWidth, 24);
    container.add(sliderBg);
    container.setData('sliderBg', sliderBg);
    container.setData('sliderTrackWidth', sliderTrackWidth);

    const sliderFill = this.add.graphics();
    container.add(sliderFill);
    container.setData('sliderFill', sliderFill);

    // Separator line
    const sep = this.add.graphics();
    if (typeof sep.lineStyle === 'function') {
      sep.lineStyle(1, 0x334155, 0.5);
    }
    if (typeof sep.lineBetween === 'function') {
      sep.lineBetween(0, 110, usableWidth, 110);
    }
    container.add(sep);

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

    this.keybindCaptureText = this.add
      .text(width / 2, height / 2, 'Press any key...', {
        fontFamily: 'Arial Black',
        fontSize: '48px',
        color: '#ffffff'
      })
      .setOrigin(0.5, 0.5);
    this.keybindOverlay.add(this.keybindCaptureText);

    const cancelText = this.add
      .text(width / 2, height / 2 + 60, 'Press ESC to cancel', {
        fontFamily: 'Arial',
        fontSize: '24px',
        color: '#888888'
      })
      .setOrigin(0.5, 0.5);
    this.keybindOverlay.add(cancelText);
  }

  // (instructions removed — navigation is self-evident with ◀ ▶ and back button)

  // ========================================
  // TOUCH INTERACTIVITY
  // ========================================

  /**
   * Enable touch on option item displays — tapping toggles/selects,
   * dragging on slider tracks adjusts the value.
   */
  enableTouchOnOptionItems() {
    this.optionDisplays.forEach((display, index) => {
      const { width } = this.cameras.main;
      const hitHeight = 120;
      display.setInteractive(
        new Phaser.Geom.Rectangle(0, 0, width - 80, hitHeight),
        Phaser.Geom.Rectangle.Contains
      );

      display.on('pointerdown', (/** @type {Phaser.Input.Pointer} */ pointer) => {
        if (this.transitioning || this.capturingKeybind) {
          return;
        }
        const category = this.categories[this.selectedCategoryIndex];
        if (index >= category.items.length) {
          return;
        }

        this.selectedIndex = index;
        const item = category.items[index];

        if (item.type === 'slider') {
          // Start drag — compute value from pointer X relative to container
          this._draggingSliderIndex = index;
          this._applySliderPointer(item, display, pointer);
        } else {
          this.onSelect();
        }
      });

      display.on('pointermove', (/** @type {Phaser.Input.Pointer} */ pointer) => {
        if (this._draggingSliderIndex !== index) {
          return;
        }
        const category = this.categories[this.selectedCategoryIndex];
        const item = category.items[index];
        if (item?.type === 'slider') {
          this._applySliderPointer(item, display, pointer);
        }
      });

      display.on('pointerup', () => {
        if (this._draggingSliderIndex === index) {
          this._draggingSliderIndex = -1;
          this.saveOptions();
        }
      });

      display.on('pointerout', () => {
        if (this._draggingSliderIndex === index) {
          this._draggingSliderIndex = -1;
          this.saveOptions();
        }
      });
    });

    this._draggingSliderIndex = -1;
  }

  /**
   * Map a pointer position to a slider value and update display.
   * @param {OptionItem} item
   * @param {Phaser.GameObjects.Container} display
   * @param {Phaser.Input.Pointer} pointer
   * @private
   */
  _applySliderPointer(item, display, pointer) {
    const trackWidth = display.getData('sliderTrackWidth') || 640;
    // pointer.x is in scene coords; display.x is the container's left edge
    const localX = pointer.x - display.x;
    const ratio = Math.max(0, Math.min(1, localX / trackWidth));
    const minVal = item.min || 0;
    const maxVal = item.max || 100;
    const stepVal = item.step || 1;
    const raw = minVal + ratio * (maxVal - minVal);
    // Snap to step
    item.value = Math.round(raw / stepVal) * stepVal;
    item.value = Math.max(minVal, Math.min(maxVal, Math.round(item.value * 1000) / 1000));
    if (item.key === 'masterVolume' || item.key === 'musicVolume' || item.key === 'sfxVolume') {
      this._applyLiveVolumePreview();
    }
    this.updateDisplay();
  }

  // ========================================
  // LIVE VOLUME PREVIEW
  // ========================================

  /**
   * Read current volume slider values from the category items and apply
   * the effective volume to the Phaser sound manager so the user hears
   * changes in real-time.
   * @private
   */
  _applyLiveVolumePreview() {
    const audioCategory = this.categories.find((c) => c.name === 'Audio');
    if (!audioCategory) {
      return;
    }

    let masterVolume = 100;
    let musicVolume = 100;

    for (const item of audioCategory.items) {
      if (item.key === 'masterVolume') {
        masterVolume = item.value ?? 100;
      }
      if (item.key === 'musicVolume') {
        musicVolume = item.value ?? 100;
      }
    }

    const effectiveVolume = (masterVolume / 100) * (musicVolume / 100);
    if (this.sound) {
      this.sound.volume = effectiveVolume;
    }
  }

  // ========================================
  // KEYBIND CAPTURE
  // ========================================

  /**
   * @param {KeyboardEvent} event
   */
  onAnyKeyDown(event) {
    if (!this.capturingKeybind) {
      return;
    }
    const key = codeToStoredKey(event.code || event.key);
    if (key === 'ESCAPE') {
      return;
    }
    if (this.captureKeybindItem) {
      this.captureKeybindItem.value = key;
    }
    this.saveOptions();
    this.cancelKeybindCapture();
    this.updateDisplay();
  }

  /**
   * @param {OptionItem} item
   */
  startKeybindCapture(item) {
    this.capturingKeybind = true;
    /** @type {OptionItem | null} */
    this.captureKeybindItem = item;
    this.keybindOverlay?.setVisible(true);
    this.keybindCaptureText?.setText(`Press key for: ${item.name}`);
  }

  cancelKeybindCapture() {
    this.capturingKeybind = false;
    /** @type {OptionItem | null} */
    this.captureKeybindItem = null;
    this.keybindOverlay?.setVisible(false);
  }

  // ========================================
  // ACTIONS
  // ========================================

  /**
   * @param {string} action
   */
  executeAction(action) {
    switch (action) {
      case 'calibrate':
        console.warn('Starting offset calibration...');
        break;
      case 'reset':
        this.resetToDefaults();
        break;
    }
  }

  resetToDefaults() {
    this.saveManager.resetOptions();
    this.categories.forEach((category) => {
      category.items.forEach((item) => {
        if (item.defaultValue !== undefined) {
          item.value = item.defaultValue;
        }
      });
    });
    this.saveOptions();
    this.updateDisplay();
  }

  // ========================================
  // DISPLAY
  // ========================================

  updateDisplay() {
    // Update category label
    if (this.categoryLabel) {
      const cat = this.categories[this.selectedCategoryIndex];
      this.categoryLabel.setText(cat ? cat.name : '');
    }

    const category = this.categories[this.selectedCategoryIndex];

    this.optionDisplays.forEach((display, index) => {
      const item = category.items[index];
      if (!item) {
        display.setVisible(false);
        return;
      }

      display.setVisible(true);
      const nameText = display.getData('nameText');
      const valueText = display.getData('valueText');
      const descText = display.getData('descText');
      const sliderBg = display.getData('sliderBg');
      const sliderFill = display.getData('sliderFill');
      const trackWidth = display.getData('sliderTrackWidth') || 640;

      nameText.setText(item.name);
      nameText.setColor(index === this.selectedIndex ? '#ffff00' : '#ffffff');
      descText?.setText(OPTION_DESCRIPTIONS[item.key] || '');

      switch (item.type) {
        case 'toggle':
          valueText.setText(item.value ? 'ON' : 'OFF');
          valueText.setColor(item.value ? '#00ff00' : '#ff0000');
          sliderBg.setVisible(false);
          sliderFill.setVisible(false);
          break;
        case 'slider':
          valueText.setText(`${item.value}`);
          valueText.setColor(
            index === this.selectedIndex && this.editingSlider ? '#00ff00' : '#ffffff'
          );
          sliderBg.setVisible(true);
          sliderFill.setVisible(true);
          sliderFill.clear();
          sliderFill.fillStyle(
            index === this.selectedIndex && this.editingSlider ? 0x00ffff : 0x00ff00,
            1
          );
          sliderFill.fillRect(
            0,
            48,
            (((item.value || 0) - (item.min || 0)) / ((item.max || 100) - (item.min || 0))) *
              trackWidth,
            24
          );
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
    this.categories.forEach((category) => {
      category.items.forEach((item) => {
        if (item.type !== 'action') {
          item.value = this.saveManager.getOption(item.key);
        }
      });
    });
  }

  saveOptions() {
    /** @type {Record<string, any>} */
    const data = {};
    this.categories.forEach((category) => {
      category.items.forEach((item) => {
        if (item.type !== 'action') {
          data[item.key] = item.value;
        }
      });
    });
    this.saveManager.setOptions(data);
  }

  shutdown() {
    super.shutdown();
    this.categoryTabs = [];
    this.optionDisplays = [];
    this.backButton = null;
    this.categoryLabel = null;
    this.prevCatButton = null;
    this.nextCatButton = null;
    this._draggingSliderIndex = -1;
  }
}

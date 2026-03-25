/**
 * @fileoverview Generated gameplay visuals used while the atlas pipeline is incomplete.
 */

import * as Constants from '../core/Constants.js';

const NOTE_COLORS = [
  Constants.COLOR_NOTES[0],
  Constants.COLOR_NOTES[1],
  Constants.COLOR_NOTES[2],
  Constants.COLOR_NOTES[3]
];

const NOTE_TEXTURE_PREFIX = 'generated-note';
const RECEPTOR_TEXTURE_PREFIX = 'generated-receptor';
const RECEPTOR_Y_OFFSET = 52;

function colorToHex(color) {
  return `#${color.toString(16).padStart(6, '0')}`;
}

/**
 * Functional-first generated note/receptor visuals.
 */
export default class GeneratedGameplaySkin {
  /**
   * @param {Phaser.Scene} scene
   */
  constructor(scene) {
    this.scene = scene;
    this.attachments = new Map();
    this.ensureTextures();
  }

  ensureTextures() {
    if (!this.scene?.textures) {
      return;
    }

    for (let direction = 0; direction < 4; direction++) {
      const noteKey = `${NOTE_TEXTURE_PREFIX}-${direction}`;
      const receptorKey = `${RECEPTOR_TEXTURE_PREFIX}-${direction}`;

      if (!this.scene.textures.exists(noteKey)) {
        this.generateCircularTexture(noteKey, NOTE_COLORS[direction], 0xffffff, 24, 64);
      }

      if (!this.scene.textures.exists(receptorKey)) {
        this.generateCircularTexture(receptorKey, 0x111111, NOTE_COLORS[direction], 26, 72, 6);
      }
    }
  }

  generateCircularTexture(key, fillColor, strokeColor, radius, size, lineWidth = 4) {
    const graphics = this.scene.add.graphics();
    graphics.clear();
    graphics.fillStyle(fillColor, 1);
    graphics.lineStyle(lineWidth, strokeColor, 1);
    graphics.fillCircle(size / 2, size / 2, radius);
    graphics.strokeCircle(size / 2, size / 2, radius);
    graphics.generateTexture(key, size, size);
    graphics.destroy();
  }

  createNoteStyle() {
    return {
      buildNoteSprite: (noteSprite) => {
        const key = `${NOTE_TEXTURE_PREFIX}-${noteSprite.direction}`;
        noteSprite.setTexture(key);
        noteSprite.setDisplaySize(72, 72);
        noteSprite.setOrigin(0.5, 0.5);
        noteSprite.setDepth(30);
      }
    };
  }

  /**
   * @param {import('./Strumline.js').default} strumline
   * @param {{alpha?: number}} [options]
   */
  attachStrumline(strumline, options = {}) {
    const alpha = options.alpha ?? 1;
    const receptorSprites = strumline.receptors.map((receptor) => {
      const sprite = this.scene.add.image(0, 0, `${RECEPTOR_TEXTURE_PREFIX}-${receptor.direction}`);
      sprite.setDepth(40);
      sprite.setAlpha(alpha * 0.7);
      return sprite;
    });

    const holdGraphics = this.scene.add.graphics();
    holdGraphics.setDepth(20);

    this.attachments.set(strumline, {
      alpha,
      receptorSprites,
      holdGraphics
    });

    this.syncAttachment(strumline);
  }

  /**
   * @param {number} delta
   */
  update(delta = 16.67) {
    this.attachments.forEach((attachment, strumline) => {
      this.syncAttachment(strumline, attachment);
      attachment.holdGraphics.clear();
      strumline.holdNotes.forEach((holdNote) => {
        if (!holdNote?.alive || !holdNote.visible) {
          return;
        }

        holdNote.draw(attachment.holdGraphics);
      });
    });
  }

  syncAttachment(strumline, attachment = this.attachments.get(strumline)) {
    if (!attachment) {
      return;
    }

    attachment.receptorSprites.forEach((sprite, direction) => {
      const state = strumline.getReceptorState(direction);
      const scale = state === 'confirm' ? 1.15 : state === 'press' ? 1.05 : 1;
      const alpha = state === 'confirm' ? 1 : state === 'press' ? 0.9 : 0.65;

      sprite.setPosition(
        strumline.x + strumline.getXPos(direction),
        strumline.y + RECEPTOR_Y_OFFSET
      );
      sprite.setScale(scale);
      sprite.setAlpha(alpha * attachment.alpha);
    });
  }

  destroy() {
    this.attachments.forEach((attachment) => {
      attachment.receptorSprites.forEach((sprite) => sprite.destroy());
      attachment.holdGraphics.destroy();
    });
    this.attachments.clear();
    this.scene = null;
  }

  static getLaneColor(direction) {
    return colorToHex(NOTE_COLORS[direction] ?? NOTE_COLORS[0]);
  }
}

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
  constructor(scene, config = {}) {
    this.scene = scene;
    this.noteStyleId = config.noteStyleId ?? null;
    this.noteStyleRegistry = config.noteStyleRegistry ?? null;
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
        if (this.applyRegistryNoteStyle(noteSprite)) {
          noteSprite.setOrigin(0.5, 0.5);
          noteSprite.setDepth(30);
          return;
        }

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
      const sprite = this.createReceptorSprite(receptor.direction);
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

    const baseScale = this.getReceptorBaseScale();

    attachment.receptorSprites.forEach((sprite, direction) => {
      const state = strumline.getReceptorState(direction);
      const stateScale = state === 'confirm' ? 1.15 : state === 'press' ? 1.05 : 1;
      const alpha = state === 'confirm' ? 1 : state === 'press' ? 0.9 : 0.65;

      this.applyRegistryReceptorState(sprite, direction, state);

      sprite.setPosition(
        strumline.x + strumline.getXPos(direction),
        strumline.y + RECEPTOR_Y_OFFSET
      );
      sprite.setScale(baseScale * stateScale);
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

  getReceptorBaseScale() {
    const asset = this.getNoteStyleAsset('noteStrumline');
    return (asset?.scale ?? 0.7) * 0.7;
  }

  getTextureKey(assetKey) {
    if (!this.noteStyleId) {
      return null;
    }

    return `notestyle-${this.noteStyleId}-${assetKey}`;
  }

  getNoteStyleAsset(assetKey) {
    if (!this.noteStyleRegistry || !this.noteStyleId) {
      return null;
    }

    return this.noteStyleRegistry.getAsset(this.noteStyleId, assetKey);
  }

  findAtlasFrame(textureKey, prefix) {
    if (!textureKey || !prefix || !this.scene?.textures?.exists?.(textureKey)) {
      return null;
    }

    const frames = this.scene.textures.get(textureKey)?.getFrameNames?.() ?? [];
    return frames.find((frameName) => frameName.startsWith(prefix)) ?? null;
  }

  applyRegistryNoteStyle(noteSprite) {
    const textureKey = this.getTextureKey('note');
    if (!textureKey || !this.scene?.textures?.exists?.(textureKey)) {
      return false;
    }

    const noteData = this.noteStyleRegistry?.getNoteData(this.noteStyleId, noteSprite.direction);
    const frame = this.findAtlasFrame(textureKey, noteData?.prefix);
    if (!frame) {
      return false;
    }

    const noteAsset = this.getNoteStyleAsset('note');
    noteSprite.setTexture(textureKey, frame);
    noteSprite.setScale(noteAsset?.scale ?? 0.7);
    return true;
  }

  createReceptorSprite(direction) {
    const textureKey = this.getTextureKey('noteStrumline');
    const frame = this.getStrumlineFrame(direction, 'static');

    if (textureKey && frame && this.scene?.textures?.exists?.(textureKey)) {
      const sprite = this.scene.add.sprite(0, 0, textureKey, frame);
      // Scale receptors to match note arrow size (~110px display)
      const asset = this.getNoteStyleAsset('noteStrumline');
      sprite.setScale((asset?.scale ?? 0.7) * 0.7);
      return sprite;
    }

    return this.scene.add.image(0, 0, `${RECEPTOR_TEXTURE_PREFIX}-${direction}`);
  }

  getStrumlineFrame(direction, state) {
    if (!this.noteStyleRegistry || !this.noteStyleId) {
      return null;
    }

    const stateName = state === 'confirm' ? 'Confirm' : state === 'press' ? 'Press' : 'Static';
    const frameData = this.noteStyleRegistry.getStrumlineData(
      this.noteStyleId,
      direction,
      stateName
    );

    return this.findAtlasFrame(this.getTextureKey('noteStrumline'), frameData?.prefix);
  }

  applyRegistryReceptorState(sprite, direction, state) {
    if (typeof sprite.setFrame !== 'function') {
      return;
    }

    const frame = this.getStrumlineFrame(direction, state);
    if (frame) {
      sprite.setFrame(frame);
    }
  }

  static getLaneColor(direction) {
    return colorToHex(NOTE_COLORS[direction] ?? NOTE_COLORS[0]);
  }
}

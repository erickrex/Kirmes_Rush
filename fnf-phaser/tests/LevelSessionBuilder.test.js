/**
 * @fileoverview Tests for level song resolution and session building.
 */

import { vi } from 'vitest';
import { describe, it, expect } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';

vi.mock('../src/core/EventBus.js', () => ({
  default: {
    emit: vi.fn(),
    on: vi.fn(),
    off: vi.fn()
  },
  Events: {
    LEVEL_LOADED: 'levelLoaded'
  }
}));

import LevelContentResolver from '../src/levels/LevelContentResolver.js';
import LevelSessionBuilder from '../src/levels/LevelSessionBuilder.js';

function createFileBackedFetch() {
  return async (requestPath) => {
    const relativePath = String(requestPath).replace(/^\.\//, '');
    const cwd = process.cwd();
    const filePath = relativePath.startsWith('data/')
      ? path.resolve(cwd, 'public', relativePath)
      : path.resolve(cwd, '..', relativePath);

    try {
      const raw = await fs.readFile(filePath, 'utf8');
      return {
        ok: true,
        status: 200,
        async json() {
          return JSON.parse(raw);
        }
      };
    } catch {
      return {
        ok: false,
        status: 404,
        async json() {
          throw new Error(`Missing fixture for ${relativePath}`);
        }
      };
    }
  };
}

describe('LevelSessionBuilder', () => {
  const fetchImpl = createFileBackedFetch();

  it('resolves each playable level song ID to a manifest entry', async () => {
    const resolver = new LevelContentResolver({ fetchImpl });
    await resolver.load();

    ['tutorial', 'bopeebo', 'fresh', 'blammed', 'stress'].forEach((songId) => {
      expect(resolver.resolveSong(songId)).toBeTruthy();
    });
  });

  it('normalizes the selected chart difficulty into player/opponent notes with directions', async () => {
    const builder = new LevelSessionBuilder({ fetchImpl });
    const session = await builder.build('level-5-mastery');

    expect(session.chart.notes.player.length).toBeGreaterThan(0);
    expect(session.chart.notes.opponent.length).toBeGreaterThan(0);
    expect(session.chart.notes.player.every((note) => typeof note.direction === 'number')).toBe(true);
    expect(session.chart.notes.opponent.every((note) => typeof note.direction === 'number')).toBe(true);
  });

  it('strips sustain lengths when hold notes are disabled', async () => {
    const builder = new LevelSessionBuilder({ fetchImpl });
    const session = await builder.build({
      id: 'test-no-holds',
      name: 'No Holds',
      description: 'Normalization test',
      songId: 'bopeebo',
      difficulty: 'normal',
      features: {
        holdNotes: false,
        healthBar: false,
        characters: false,
        stage: false,
        cameraEffects: false,
        noteSplashes: false,
        comboPopups: false,
        expandedStats: false,
        replayRecording: false,
        inputBuffer: false
      },
      ui: {
        showScore: true,
        showCombo: true,
        showAccuracy: false,
        showMisses: false
      }
    });

    expect(session.chart.notes.player.some((note) => note.length > 0)).toBe(false);
    expect(session.chart.notes.opponent.some((note) => note.length > 0)).toBe(false);
  });
});

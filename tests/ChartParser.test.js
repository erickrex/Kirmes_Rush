/**
 * @fileoverview Unit tests for the ChartParser
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import ChartParser from '../src/data/parsers/ChartParser.js';

// Sample test data based on actual Rythm Foundation chart format
const sampleMetadata = {
  version: '2.2.4',
  timeFormat: 'ms',
  artist: 'Kawai Sprite',
  charter: 'ninjamuffin99',
  playData: {
    ratings: { easy: 0, normal: 0, hard: 1 },
    stage: 'mainStage',
    characters: { player: 'bf', opponent: 'gf' },
    difficulties: ['easy', 'normal', 'hard'],
    noteStyle: 'rythm',
    album: 'volume1',
    previewStart: 0,
    previewEnd: 15000
  },
  songName: 'Tutorial',
  timeChanges: [{ d: 4, n: 4, t: -1, bt: [4, 4, 4, 4], bpm: 100 }],
  generatedBy: 'Chart Editor'
};

const sampleChart = {
  version: '2.0.0',
  scrollSpeed: { easy: 1, normal: 1, hard: 1.2 },
  events: [
    { t: 0, e: 'FocusCamera', v: { char: 0 } },
    { t: 9600, e: 'FocusCamera', v: { char: 1 } },
    { t: 9600, e: 'ZoomCamera', v: { ease: 'elasticInOut', duration: 4, zoom: 1.3 } }
  ],
  notes: {
    easy: [
      { t: 9600, d: 4 },
      { t: 10800, d: 7 },
      { t: 12000, d: 0 },
      { t: 13200, d: 3 }
    ],
    normal: [
      { t: 9600, d: 4 },
      { t: 10800, d: 7 },
      { t: 12000, d: 0 },
      { t: 13200, d: 3 },
      { t: 14400, d: 1, l: 600 }
    ],
    hard: [
      { t: 9600, d: 4 },
      { t: 10200, d: 5 },
      { t: 10800, d: 7 },
      { t: 11400, d: 6 },
      { t: 12000, d: 0, l: 1200 },
      { t: 13200, d: 3, k: 'mine' }
    ]
  },
  generatedBy: 'Rythm Foundation Chart Editor'
};

describe('ChartParser', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('parseMetadata', () => {
    it('should parse valid metadata', () => {
      const result = ChartParser.parseMetadata(sampleMetadata);

      expect(result).not.toBeNull();
      expect(result.version).toBe('2.2.4');
      expect(result.songName).toBe('Tutorial');
      expect(result.artist).toBe('Kawai Sprite');
      expect(result.charter).toBe('ninjamuffin99');
      expect(result.timeFormat).toBe('ms');
    });

    it('should parse play data correctly', () => {
      const result = ChartParser.parseMetadata(sampleMetadata);

      expect(result.playData.stage).toBe('mainStage');
      expect(result.playData.noteStyle).toBe('rythm');
      expect(result.playData.difficulties).toEqual(['easy', 'normal', 'hard']);
      expect(result.playData.album).toBe('volume1');
      expect(result.playData.previewStart).toBe(0);
      expect(result.playData.previewEnd).toBe(15000);
    });

    it('should parse character data correctly', () => {
      const result = ChartParser.parseMetadata(sampleMetadata);

      expect(result.playData.characters.player).toBe('bf');
      expect(result.playData.characters.opponent).toBe('gf');
    });

    it('should parse time changes correctly', () => {
      const result = ChartParser.parseMetadata(sampleMetadata);

      expect(result.timeChanges).toHaveLength(1);
      expect(result.timeChanges[0].bpm).toBe(100);
      expect(result.timeChanges[0].n).toBe(4);
      expect(result.timeChanges[0].d).toBe(4);
    });

    it('should return null for invalid input', () => {
      expect(ChartParser.parseMetadata(null)).toBeNull();
      expect(ChartParser.parseMetadata(undefined)).toBeNull();
      expect(ChartParser.parseMetadata('string')).toBeNull();
    });

    it('should return null for missing play data', () => {
      const invalid = { ...sampleMetadata, playData: null };
      expect(ChartParser.parseMetadata(invalid)).toBeNull();
    });

    it('should use default values for missing fields', () => {
      const minimal = {
        playData: {
          characters: { player: 'bf' }
        },
        timeChanges: [{ bpm: 120 }]
      };

      const result = ChartParser.parseMetadata(minimal);

      expect(result.songName).toBe('Unknown');
      expect(result.artist).toBe('Unknown');
      expect(result.timeFormat).toBe('ms');
      expect(result.playData.stage).toBe('mainStage');
      expect(result.playData.noteStyle).toBe('rythm');
    });

    it('should set variation from parameter', () => {
      const result = ChartParser.parseMetadata(sampleMetadata, 'erect');
      expect(result.variation).toBe('erect');
    });
  });

  describe('parseChart', () => {
    it('should parse valid chart data', () => {
      const result = ChartParser.parseChart(sampleChart);

      expect(result).not.toBeNull();
      expect(result.version).toBe('2.0.0');
      expect(result.generatedBy).toBe('Rythm Foundation Chart Editor');
    });

    it('should parse scroll speeds correctly', () => {
      const result = ChartParser.parseChart(sampleChart);

      expect(result.scrollSpeed.easy).toBe(1);
      expect(result.scrollSpeed.normal).toBe(1);
      expect(result.scrollSpeed.hard).toBe(1.2);
    });

    it('should parse events correctly', () => {
      const result = ChartParser.parseChart(sampleChart);

      expect(result.events).toHaveLength(3);
      expect(result.events[0].time).toBe(0);
      expect(result.events[0].event).toBe('FocusCamera');
      expect(result.events[0].value).toEqual({ char: 0 });
    });

    it('should sort events by time', () => {
      const unsorted = {
        ...sampleChart,
        events: [
          { t: 9600, e: 'Event2' },
          { t: 0, e: 'Event1' },
          { t: 4800, e: 'Event3' }
        ]
      };

      const result = ChartParser.parseChart(unsorted);

      expect(result.events[0].time).toBe(0);
      expect(result.events[1].time).toBe(4800);
      expect(result.events[2].time).toBe(9600);
    });

    it('should parse notes for each difficulty', () => {
      const result = ChartParser.parseChart(sampleChart);

      expect(result.notes.easy).toHaveLength(4);
      expect(result.notes.normal).toHaveLength(5);
      expect(result.notes.hard).toHaveLength(6);
    });

    it('should parse note properties correctly', () => {
      const result = ChartParser.parseChart(sampleChart);

      // Basic note
      expect(result.notes.easy[0].time).toBe(9600);
      expect(result.notes.easy[0].data).toBe(4);
      expect(result.notes.easy[0].length).toBe(0);

      // Hold note
      expect(result.notes.normal[4].length).toBe(600);

      // Note with kind
      expect(result.notes.hard[5].kind).toBe('mine');
    });

    it('should sort notes by time', () => {
      const unsorted = {
        ...sampleChart,
        notes: {
          test: [
            { t: 1200, d: 0 },
            { t: 600, d: 1 },
            { t: 0, d: 2 }
          ]
        }
      };

      const result = ChartParser.parseChart(unsorted);

      expect(result.notes.test[0].time).toBe(0);
      expect(result.notes.test[1].time).toBe(600);
      expect(result.notes.test[2].time).toBe(1200);
    });

    it('should return null for invalid input', () => {
      expect(ChartParser.parseChart(null)).toBeNull();
      expect(ChartParser.parseChart(undefined)).toBeNull();
    });

    it('should handle missing notes gracefully', () => {
      const noNotes = { ...sampleChart, notes: null };
      const result = ChartParser.parseChart(noNotes);

      expect(result.notes).toEqual({});
    });

    it('should handle missing events gracefully', () => {
      const noEvents = { ...sampleChart, events: null };
      const result = ChartParser.parseChart(noEvents);

      expect(result.events).toEqual([]);
    });
  });

  describe('parseTimeChanges', () => {
    it('should parse time changes array', () => {
      const timeChanges = [
        { t: 0, bpm: 100, n: 4, d: 4 },
        { t: 10000, bpm: 120, n: 3, d: 4 }
      ];

      const result = ChartParser.parseTimeChanges(timeChanges);

      expect(result).toHaveLength(2);
      expect(result[0].bpm).toBe(100);
      expect(result[1].bpm).toBe(120);
      expect(result[1].n).toBe(3);
    });

    it('should return default time change for invalid input', () => {
      const result = ChartParser.parseTimeChanges(null);

      expect(result).toHaveLength(1);
      expect(result[0].bpm).toBe(100);
      expect(result[0].n).toBe(4);
      expect(result[0].d).toBe(4);
    });

    it('should sort time changes by timestamp', () => {
      const unsorted = [
        { t: 5000, bpm: 120 },
        { t: 0, bpm: 100 },
        { t: 2500, bpm: 110 }
      ];

      const result = ChartParser.parseTimeChanges(unsorted);

      expect(result[0].t).toBe(0);
      expect(result[1].t).toBe(2500);
      expect(result[2].t).toBe(5000);
    });

    it('should filter out invalid entries', () => {
      const mixed = [{ t: 0, bpm: 100 }, null, undefined, { t: 1000, bpm: 120 }];

      const result = ChartParser.parseTimeChanges(mixed);

      expect(result).toHaveLength(2);
    });
  });

  describe('Note utility methods', () => {
    const testNote = { time: 1000, data: 5, length: 0 };
    const holdNote = { time: 2000, data: 0, length: 600 };
    const playerNote = { time: 3000, data: 2, length: 0 };
    const opponentNote = { time: 4000, data: 6, length: 0 };

    describe('getNoteDirection', () => {
      it('should return correct direction for player notes', () => {
        expect(ChartParser.getNoteDirection({ data: 0 })).toBe(0); // left
        expect(ChartParser.getNoteDirection({ data: 1 })).toBe(1); // down
        expect(ChartParser.getNoteDirection({ data: 2 })).toBe(2); // up
        expect(ChartParser.getNoteDirection({ data: 3 })).toBe(3); // right
      });

      it('should return correct direction for opponent notes', () => {
        expect(ChartParser.getNoteDirection({ data: 4 })).toBe(0); // left
        expect(ChartParser.getNoteDirection({ data: 5 })).toBe(1); // down
        expect(ChartParser.getNoteDirection({ data: 6 })).toBe(2); // up
        expect(ChartParser.getNoteDirection({ data: 7 })).toBe(3); // right
      });
    });

    describe('getNoteDirectionName', () => {
      it('should return direction names', () => {
        expect(ChartParser.getNoteDirectionName({ data: 0 })).toBe('left');
        expect(ChartParser.getNoteDirectionName({ data: 1 })).toBe('down');
        expect(ChartParser.getNoteDirectionName({ data: 2 })).toBe('up');
        expect(ChartParser.getNoteDirectionName({ data: 3 })).toBe('right');
      });
    });

    describe('getNoteStrumline', () => {
      it('should return 0 for player notes (data 0-3)', () => {
        expect(ChartParser.getNoteStrumline({ data: 0 })).toBe(0);
        expect(ChartParser.getNoteStrumline({ data: 1 })).toBe(0);
        expect(ChartParser.getNoteStrumline({ data: 2 })).toBe(0);
        expect(ChartParser.getNoteStrumline({ data: 3 })).toBe(0);
      });

      it('should return 1 for opponent notes (data 4-7)', () => {
        expect(ChartParser.getNoteStrumline({ data: 4 })).toBe(1);
        expect(ChartParser.getNoteStrumline({ data: 5 })).toBe(1);
        expect(ChartParser.getNoteStrumline({ data: 6 })).toBe(1);
        expect(ChartParser.getNoteStrumline({ data: 7 })).toBe(1);
      });
    });

    describe('isPlayerNote', () => {
      it('should return true for player notes', () => {
        expect(ChartParser.isPlayerNote(playerNote)).toBe(true);
        expect(ChartParser.isPlayerNote({ data: 0 })).toBe(true);
        expect(ChartParser.isPlayerNote({ data: 3 })).toBe(true);
      });

      it('should return false for opponent notes', () => {
        expect(ChartParser.isPlayerNote(opponentNote)).toBe(false);
        expect(ChartParser.isPlayerNote({ data: 4 })).toBe(false);
        expect(ChartParser.isPlayerNote({ data: 7 })).toBe(false);
      });
    });

    describe('isHoldNote', () => {
      it('should return true for hold notes', () => {
        expect(ChartParser.isHoldNote(holdNote)).toBe(true);
        expect(ChartParser.isHoldNote({ length: 100 })).toBe(true);
      });

      it('should return false for regular notes', () => {
        expect(ChartParser.isHoldNote(testNote)).toBe(false);
        expect(ChartParser.isHoldNote({ length: 0 })).toBe(false);
      });
    });
  });

  describe('getNotesForDifficulty', () => {
    it('should return notes for specified difficulty', () => {
      const chart = ChartParser.parseChart(sampleChart);

      const easyNotes = ChartParser.getNotesForDifficulty(chart, 'easy');
      const hardNotes = ChartParser.getNotesForDifficulty(chart, 'hard');

      expect(easyNotes).toHaveLength(4);
      expect(hardNotes).toHaveLength(6);
    });

    it('should fall back to normal if difficulty not found', () => {
      const chart = ChartParser.parseChart(sampleChart);

      const notes = ChartParser.getNotesForDifficulty(chart, 'nightmare');

      expect(notes).toHaveLength(5); // normal has 5 notes
    });

    it('should return empty array if no notes found', () => {
      const chart = { notes: {} };

      const notes = ChartParser.getNotesForDifficulty(chart, 'easy');

      expect(notes).toEqual([]);
    });
  });

  describe('getScrollSpeed', () => {
    it('should return scroll speed for difficulty', () => {
      const chart = ChartParser.parseChart(sampleChart);

      expect(ChartParser.getScrollSpeed(chart, 'easy')).toBe(1);
      expect(ChartParser.getScrollSpeed(chart, 'hard')).toBe(1.2);
    });

    it('should fall back to default if not found', () => {
      const chart = { scrollSpeed: { default: 1.5 } };

      expect(ChartParser.getScrollSpeed(chart, 'nightmare')).toBe(1.5);
    });

    it('should return 1.0 if no scroll speed defined', () => {
      const chart = { scrollSpeed: {} };

      expect(ChartParser.getScrollSpeed(chart, 'easy')).toBe(1.0);
    });
  });

  describe('separateNotes', () => {
    it('should separate player and opponent notes', () => {
      const notes = [
        { data: 0 }, // player
        { data: 4 }, // opponent
        { data: 2 }, // player
        { data: 6 }, // opponent
        { data: 1 }, // player
        { data: 5 } // opponent
      ];

      const { player, opponent } = ChartParser.separateNotes(notes);

      expect(player).toHaveLength(3);
      expect(opponent).toHaveLength(3);
      expect(player.every((n) => n.data < 4)).toBe(true);
      expect(opponent.every((n) => n.data >= 4)).toBe(true);
    });
  });

  describe('Version validation', () => {
    describe('isValidMetadataVersion', () => {
      it('should accept supported versions', () => {
        expect(ChartParser.isValidMetadataVersion('2.2.4')).toBe(true);
        expect(ChartParser.isValidMetadataVersion('2.2.0')).toBe(true);
        expect(ChartParser.isValidMetadataVersion('2.0.0')).toBe(true);
      });

      it('should reject unsupported versions', () => {
        expect(ChartParser.isValidMetadataVersion('1.0.0')).toBe(false);
        expect(ChartParser.isValidMetadataVersion('3.0.0')).toBe(false);
      });

      it('should handle null/undefined', () => {
        expect(ChartParser.isValidMetadataVersion(null)).toBe(false);
        expect(ChartParser.isValidMetadataVersion(undefined)).toBe(false);
      });
    });

    describe('isValidChartVersion', () => {
      it('should accept supported versions', () => {
        expect(ChartParser.isValidChartVersion('2.0.0')).toBe(true);
        expect(ChartParser.isValidChartVersion('2.0.1')).toBe(true);
      });

      it('should reject unsupported versions', () => {
        expect(ChartParser.isValidChartVersion('1.0.0')).toBe(false);
        expect(ChartParser.isValidChartVersion('3.0.0')).toBe(false);
      });
    });
  });

  describe('getChartStats', () => {
    it('should return correct statistics', () => {
      const chart = ChartParser.parseChart(sampleChart);
      const stats = ChartParser.getChartStats(chart, 'hard');

      expect(stats.totalNotes).toBe(6);
      expect(stats.holdNotes).toBe(1);
      expect(stats.totalHoldLength).toBe(1200);
      expect(stats.events).toBe(3);
      expect(stats.scrollSpeed).toBe(1.2);
    });

    it('should separate player and opponent note counts', () => {
      const chart = ChartParser.parseChart(sampleChart);
      const stats = ChartParser.getChartStats(chart, 'easy');

      // easy notes: d=4,7,0,3 -> opponent: 4,7 (2), player: 0,3 (2)
      expect(stats.playerNotes).toBe(2);
      expect(stats.opponentNotes).toBe(2);
    });
  });
});

/**
 * @fileoverview Manifest Validation Tests
 * Validates that all song manifests are properly structured and reference valid assets
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

describe('Song Manifest Validation', () => {
  const manifestDir = join(process.cwd(), 'public', 'data', 'manifests');

  const manifests = [
    'tutorial.json',
    'week1.json',
    'week2.json',
    'week3.json',
    'week4.json',
    'week5.json',
    'week6.json',
    'week7.json',
    'weekend1.json'
  ];

  describe('Manifest File Existence', () => {
    manifests.forEach((manifestFile) => {
      it(`should have ${manifestFile} manifest file`, () => {
        const manifestPath = join(manifestDir, manifestFile);
        expect(existsSync(manifestPath)).toBe(true);
      });
    });
  });

  describe('Manifest Structure Validation', () => {
    manifests.forEach((manifestFile) => {
      describe(manifestFile, () => {
        let manifest;

        it('should be valid JSON', () => {
          const manifestPath = join(manifestDir, manifestFile);
          const content = readFileSync(manifestPath, 'utf-8');
          expect(() => {
            manifest = JSON.parse(content);
          }).not.toThrow();
        });

        it('should have required top-level fields', () => {
          const manifestPath = join(manifestDir, manifestFile);
          const content = readFileSync(manifestPath, 'utf-8');
          manifest = JSON.parse(content);

          expect(manifest).toHaveProperty('id');
          expect(manifest).toHaveProperty('name');
          expect(manifest).toHaveProperty('songs');
          expect(Array.isArray(manifest.songs)).toBe(true);
          expect(manifest.songs.length).toBeGreaterThan(0);
        });

        it('should have valid song entries', () => {
          const manifestPath = join(manifestDir, manifestFile);
          const content = readFileSync(manifestPath, 'utf-8');
          manifest = JSON.parse(content);

          manifest.songs.forEach((song, index) => {
            // Required fields
            expect(song).toHaveProperty('id');
            expect(song).toHaveProperty('name');
            expect(song).toHaveProperty('artist');
            expect(song).toHaveProperty('difficulties');
            expect(song).toHaveProperty('assets');
            expect(song).toHaveProperty('characters');
            expect(song).toHaveProperty('stage');

            // Validate difficulties
            expect(Array.isArray(song.difficulties)).toBe(true);
            expect(song.difficulties.length).toBeGreaterThan(0);
            song.difficulties.forEach((diff) => {
              expect(['easy', 'normal', 'hard', 'erect', 'nightmare']).toContain(diff);
            });

            // Validate assets structure
            expect(song.assets).toHaveProperty('chart');
            expect(song.assets).toHaveProperty('metadata');
            expect(song.assets).toHaveProperty('instrumental');

            // Vocals can be optional or an object
            if (song.assets.vocals) {
              if (typeof song.assets.vocals === 'object') {
                expect(song.assets.vocals).toHaveProperty('player');
                expect(song.assets.vocals).toHaveProperty('opponent');
              }
            }

            // Validate characters structure
            expect(song.characters).toHaveProperty('player');
            expect(song.characters).toHaveProperty('opponent');
            // girlfriend is optional

            // Validate stage
            expect(typeof song.stage).toBe('string');
            expect(song.stage.length).toBeGreaterThan(0);
          });
        });

        it('should have valid asset paths', () => {
          const manifestPath = join(manifestDir, manifestFile);
          const content = readFileSync(manifestPath, 'utf-8');
          manifest = JSON.parse(content);

          manifest.songs.forEach((song) => {
            // Check chart path format
            expect(song.assets.chart).toMatch(/^assets\/funkin\.assets\/.+\.json$/);

            // Check metadata path format
            expect(song.assets.metadata).toMatch(/^assets\/funkin\.assets\/.+\.json$/);

            // Check instrumental path format
            expect(song.assets.instrumental).toMatch(/^assets\/funkin\.assets\/.+\.(ogg|mp3)$/);

            // Check vocals path format if present
            if (song.assets.vocals) {
              if (typeof song.assets.vocals === 'object') {
                expect(song.assets.vocals.player).toMatch(/^assets\/funkin\.assets\/.+\.(ogg|mp3)$/);
                expect(song.assets.vocals.opponent).toMatch(/^assets\/funkin\.assets\/.+\.(ogg|mp3)$/);
              } else if (typeof song.assets.vocals === 'string') {
                expect(song.assets.vocals).toMatch(/^assets\/funkin\.assets\/.+\.(ogg|mp3)$/);
              }
            }
          });
        });

        it('should have unique song IDs within manifest', () => {
          const manifestPath = join(manifestDir, manifestFile);
          const content = readFileSync(manifestPath, 'utf-8');
          manifest = JSON.parse(content);

          const songIds = manifest.songs.map((song) => song.id);
          const uniqueIds = new Set(songIds);
          expect(uniqueIds.size).toBe(songIds.length);
        });
      });
    });
  });

  describe('Cross-Manifest Validation', () => {
    it('should have unique manifest IDs', () => {
      const manifestIds = manifests.map((file) => {
        const manifestPath = join(manifestDir, file);
        const content = readFileSync(manifestPath, 'utf-8');
        const manifest = JSON.parse(content);
        return manifest.id;
      });

      const uniqueIds = new Set(manifestIds);
      expect(uniqueIds.size).toBe(manifestIds.length);
    });

    it('should have all expected weeks', () => {
      const manifestIds = manifests.map((file) => {
        const manifestPath = join(manifestDir, file);
        const content = readFileSync(manifestPath, 'utf-8');
        const manifest = JSON.parse(content);
        return manifest.id;
      });

      const expectedIds = [
        'tutorial',
        'week1',
        'week2',
        'week3',
        'week4',
        'week5',
        'week6',
        'week7',
        'weekend1'
      ];

      expectedIds.forEach((id) => {
        expect(manifestIds).toContain(id);
      });
    });
  });

  describe('Song Count Validation', () => {
    it('should have correct number of songs per week', () => {
      const expectedCounts = {
        'tutorial.json': 1,
        'week1.json': 3,
        'week2.json': 3,
        'week3.json': 3,
        'week4.json': 3,
        'week5.json': 3,
        'week6.json': 3,
        'week7.json': 3,
        'weekend1.json': 4
      };

      Object.entries(expectedCounts).forEach(([file, expectedCount]) => {
        const manifestPath = join(manifestDir, file);
        const content = readFileSync(manifestPath, 'utf-8');
        const manifest = JSON.parse(content);

        expect(manifest.songs.length).toBe(expectedCount);
      });
    });

    it('should have total of 26 songs across all manifests', () => {
      let totalSongs = 0;

      manifests.forEach((file) => {
        const manifestPath = join(manifestDir, file);
        const content = readFileSync(manifestPath, 'utf-8');
        const manifest = JSON.parse(content);
        totalSongs += manifest.songs.length;
      });

      expect(totalSongs).toBe(26);
    });
  });

  describe('Character Validation', () => {
    it('should reference valid character IDs', () => {
      const validCharacters = [
        'bf',
        'bf-pixel',
        'dad',
        'mom',
        'gf',
        'gf-pixel',
        'gf-tankmen',
        'spooky',
        'monster',
        'pico',
        'senpai',
        'senpai-angry',
        'spirit',
        'tankman',
        'parents-christmas',
        'darnell',
        'nene'
      ];

      manifests.forEach((file) => {
        const manifestPath = join(manifestDir, file);
        const content = readFileSync(manifestPath, 'utf-8');
        const manifest = JSON.parse(content);

        manifest.songs.forEach((song) => {
          expect(validCharacters).toContain(song.characters.player);
          expect(validCharacters).toContain(song.characters.opponent);

          if (song.characters.girlfriend) {
            expect(validCharacters).toContain(song.characters.girlfriend);
          }
        });
      });
    });
  });

  describe('Stage Validation', () => {
    it('should reference valid stage IDs', () => {
      const validStages = [
        'stage',
        'spooky',
        'spookyMansion',
        'philly',
        'phillyStreets',
        'limo',
        'limoRide',
        'mall',
        'mall-evil',
        'school',
        'school-evil',
        'tank',
        'tankmanBattlefield'
      ];

      manifests.forEach((file) => {
        const manifestPath = join(manifestDir, file);
        const content = readFileSync(manifestPath, 'utf-8');
        const manifest = JSON.parse(content);

        manifest.songs.forEach((song) => {
          expect(validStages).toContain(song.stage);
        });
      });
    });
  });

  describe('Difficulty Validation', () => {
    it('should have at least one difficulty per song', () => {
      manifests.forEach((file) => {
        const manifestPath = join(manifestDir, file);
        const content = readFileSync(manifestPath, 'utf-8');
        const manifest = JSON.parse(content);

        manifest.songs.forEach((song) => {
          expect(song.difficulties.length).toBeGreaterThan(0);
        });
      });
    });

    it('should have normal difficulty for all songs', () => {
      manifests.forEach((file) => {
        const manifestPath = join(manifestDir, file);
        const content = readFileSync(manifestPath, 'utf-8');
        const manifest = JSON.parse(content);

        manifest.songs.forEach((song) => {
          expect(song.difficulties).toContain('normal');
        });
      });
    });
  });

  describe('Asset Path Consistency', () => {
    it('should have consistent asset path structure', () => {
      manifests.forEach((file) => {
        const manifestPath = join(manifestDir, file);
        const content = readFileSync(manifestPath, 'utf-8');
        const manifest = JSON.parse(content);

        manifest.songs.forEach((song) => {
          // Chart and metadata should be in the same directory
          const chartDir = song.assets.chart.split('/').slice(0, -1).join('/');
          const metadataDir = song.assets.metadata.split('/').slice(0, -1).join('/');
          expect(chartDir).toBe(metadataDir);

          // Instrumental and vocals should be in the same directory
          const instDir = song.assets.instrumental.split('/').slice(0, -1).join('/');

          if (song.assets.vocals) {
            if (typeof song.assets.vocals === 'object') {
              const playerVocalsDir = song.assets.vocals.player.split('/').slice(0, -1).join('/');
              const opponentVocalsDir = song.assets.vocals.opponent.split('/').slice(0, -1).join('/');
              expect(playerVocalsDir).toBe(instDir);
              expect(opponentVocalsDir).toBe(instDir);
            }
          }
        });
      });
    });
  });

  describe('Specific Week Validation', () => {
    it('Week 6 songs should use pixel characters', () => {
      const manifestPath = join(manifestDir, 'week6.json');
      const content = readFileSync(manifestPath, 'utf-8');
      const manifest = JSON.parse(content);

      manifest.songs.forEach((song) => {
        expect(song.characters.player).toBe('bf-pixel');

        if (song.characters.girlfriend) {
          expect(song.characters.girlfriend).toBe('gf-pixel');
        }
      });
    });

    it('Week 6 songs should use school stages', () => {
      const manifestPath = join(manifestDir, 'week6.json');
      const content = readFileSync(manifestPath, 'utf-8');
      const manifest = JSON.parse(content);

      manifest.songs.forEach((song) => {
        expect(['school', 'school-evil']).toContain(song.stage);
      });
    });

    it('Weekend 1 should use pico as player', () => {
      const manifestPath = join(manifestDir, 'weekend1.json');
      const content = readFileSync(manifestPath, 'utf-8');
      const manifest = JSON.parse(content);

      manifest.songs.forEach((song) => {
        expect(song.characters.player).toBe('pico');
      });
    });
  });
});

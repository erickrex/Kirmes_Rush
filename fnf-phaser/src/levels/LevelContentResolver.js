/**
 * @fileoverview Resolves level song IDs against the app-owned song manifest set.
 */

import { APP_MANIFESTS_PATH } from '../utils/GameDataPaths.js';

export const DEFAULT_MANIFEST_IDS = [
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

export const MANIFEST_BASE_PATH = APP_MANIFESTS_PATH;

/**
 * Fetch JSON with a small error wrapper so scene code gets actionable failures.
 * @param {string} path
 * @param {typeof fetch} fetchImpl
 * @returns {Promise<any>}
 */
export async function fetchJson(path, fetchImpl = globalThis.fetch) {
  if (typeof fetchImpl !== 'function') {
    throw new Error(`No fetch implementation available for ${path}`);
  }

  const response = await fetchImpl(path);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${path}: ${response.status}`);
  }
  return response.json();
}

/**
 * Loads the public tutorial/week manifests and indexes songs by `song.id`.
 */
export default class LevelContentResolver {
  /**
   * @param {{fetchImpl?: typeof fetch, manifestIds?: string[]}} [options]
   */
  constructor(options = {}) {
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch;
    this.manifestIds = options.manifestIds ?? DEFAULT_MANIFEST_IDS;
    this.manifests = [];
    this.songIndex = new Map();
    this.loaded = false;
  }

  /**
   * @returns {Promise<LevelContentResolver>}
   */
  async load() {
    if (this.loaded) {
      return this;
    }

    const manifests = await Promise.all(
      this.manifestIds.map(async (manifestId) => {
        const manifest = await fetchJson(
          `${MANIFEST_BASE_PATH}/${manifestId}.json`,
          this.fetchImpl
        );
        return {
          id: manifest.id ?? manifestId,
          name: manifest.name ?? manifestId,
          songs: Array.isArray(manifest.songs) ? manifest.songs : []
        };
      })
    );

    this.manifests = manifests;
    this.songIndex.clear();

    manifests.forEach((manifest) => {
      manifest.songs.forEach((song) => {
        this.songIndex.set(song.id, {
          ...song,
          manifestId: manifest.id,
          manifestName: manifest.name
        });
      });
    });

    this.loaded = true;
    return this;
  }

  /**
   * @param {string} songId
   * @returns {any | null}
   */
  resolveSong(songId) {
    return this.songIndex.get(songId) ?? null;
  }
}

/**
 * @fileoverview RhythmSessionBuilder - pure helpers that turn a validated
 * {@link MinigameDefinition} plus its resolved Minigame_Controller class into
 * the two things `LoadingState.prepareCallback` must return for a rhythm run
 * (task 14, R12.3 / R12.4):
 *
 *  - a flat {@link LoadingAssetEntry} array the Phaser loader can queue
 *    (character atlases, judgement popups, and the backing instrumental,
 *    all reused from `assets/rythm-foundation.assets/`, R13.1); and
 *  - a {@link RhythmSession} value object RhythmScene consumes via
 *    `scene.start('RhythmScene', { session })`.
 *
 * These are deliberately Phaser-free and fetch-free so they can be unit tested
 * in isolation and reused by both MinigameSelectState and the integration test.
 *
 * See `.kiro/specs/rhythm-minigame-prototype/design.md` (RhythmSession + Song →
 * asset mapping sections). Satisfies Requirements 12.3, 12.4, 13.1, 13.2.
 */

import { SHARED_ASSET_ROOT } from '../../utils/GameDataPaths.js';
import RhythmSession from '../core/RhythmSession.js';

/**
 * @typedef {import('../../types.js').MinigameDefinition} MinigameDefinition
 * @typedef {import('../../types.js').MinigameAsset} MinigameAsset
 */

/**
 * A loader entry in the shape `LoadingState.loadAssets` understands.
 * @typedef {Object} LoadingAssetEntry
 * @property {'atlas' | 'image' | 'audio'} type - Loader asset type.
 * @property {string} key - Phaser cache key.
 * @property {string} path - Primary file path (texture/image/audio).
 * @property {string} [atlasURL] - Atlas XML/JSON path for `atlas` entries.
 */

/**
 * Build the Phaser cache key used for a backing song's instrumental track.
 * @param {string} songId - Backing song id (from `definition.song.id`).
 * @returns {string} A stable cache key for the instrumental.
 */
export function instrumentalKeyFor(songId) {
  return `rhythm-inst-${songId}`;
}

/**
 * Resolve the committed instrumental audio path for a backing song. The `.ogg`
 * candidate is returned; `LoadingState` adds the `.mp3` fallback so browsers
 * without OGG support still load (R13.1).
 * @param {string} songId - Backing song id.
 * @returns {string} The instrumental `.ogg` path under the shared asset root.
 */
export function instrumentalPathFor(songId) {
  return `${SHARED_ASSET_ROOT}/songs/${songId}/Inst.ogg`;
}

/**
 * Convert a single Minigame_Definition asset descriptor into the loader entry
 * shape `LoadingState` understands. Atlas descriptors carry `texture`/`atlas`
 * paths; image/audio descriptors carry a generic `path`.
 * @param {MinigameAsset} asset - A definition asset descriptor.
 * @returns {LoadingAssetEntry | null} The loader entry, or null when unmappable.
 */
export function toLoadingAssetEntry(asset) {
  if (!asset || typeof asset !== 'object' || typeof asset.key !== 'string') {
    return null;
  }

  switch (asset.type) {
    case 'atlas':
      if (typeof asset.texture !== 'string') {
        return null;
      }
      return { type: 'atlas', key: asset.key, path: asset.texture, atlasURL: asset.atlas };
    case 'image':
    case 'audio': {
      const path = asset.path ?? asset.texture;
      if (typeof path !== 'string') {
        return null;
      }
      return { type: asset.type, key: asset.key, path };
    }
    default:
      return null;
  }
}

/**
 * Build the full loader manifest for a run: every definition asset that maps to
 * a loader entry, plus the backing instrumental audio (R13.1). The instrumental
 * is appended only when it is not already declared by the definition.
 * @param {MinigameDefinition} definition - The validated minigame definition.
 * @returns {LoadingAssetEntry[]} A flat, loader-ready asset manifest.
 */
export function buildAssetManifest(definition) {
  /** @type {LoadingAssetEntry[]} */
  const entries = [];
  const seenKeys = new Set();

  for (const asset of definition?.assets ?? []) {
    const entry = toLoadingAssetEntry(asset);
    if (entry && !seenKeys.has(entry.key)) {
      seenKeys.add(entry.key);
      entries.push(entry);
    }
  }

  const songId = definition?.song?.id;
  if (typeof songId === 'string' && songId.length > 0) {
    const key = instrumentalKeyFor(songId);
    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      entries.push({ type: 'audio', key, path: instrumentalPathFor(songId) });
    }
  }

  return entries;
}

/**
 * Build the RhythmClock configuration for a run. BPM is sourced from the
 * definition, which is authored to mirror the backing song's committed metadata
 * (R13.2); the offset defaults to 0.
 * @param {MinigameDefinition} definition - The validated minigame definition.
 * @returns {import('../core/RhythmSession.js').RhythmClockConfig} The clock config.
 */
export function buildClockConfig(definition) {
  return {
    bpm: typeof definition?.bpm === 'number' ? definition.bpm : 120,
    offsetMs: 0
  };
}

/**
 * Resolve the backing-song audio references for a run (R13.1).
 * @param {MinigameDefinition} definition - The validated minigame definition.
 * @returns {import('../core/RhythmSession.js').RhythmSessionAudio} The resolved audio refs.
 */
export function buildAudioRefs(definition) {
  const songId = definition?.song?.id ?? '';
  return {
    instrumentalKey: instrumentalKeyFor(songId),
    instrumentalPath: instrumentalPathFor(songId),
    songId
  };
}

/**
 * Assemble a {@link RhythmSession} value object from a validated definition and
 * its resolved controller class (R11.3, R12.3).
 * @param {MinigameDefinition} definition - The validated minigame definition.
 * @param {Function} controllerClass - The resolved Minigame_Controller class.
 * @returns {RhythmSession} The per-run session object.
 */
export function buildRhythmSession(definition, controllerClass) {
  return new RhythmSession({
    definition,
    timeline: definition?.timeline ?? [],
    clockConfig: buildClockConfig(definition),
    audio: buildAudioRefs(definition),
    scoring: definition?.scoring,
    controllerClass
  });
}

/**
 * Build the async `prepareCallback` `LoadingState` runs for a rhythm run
 * (R12.3 / R12.4). It resolves the loader manifest and the RhythmSession, then
 * returns them so LoadingState queues the assets and, once loading completes,
 * starts RhythmScene with the session.
 * @param {MinigameDefinition} definition - The validated minigame definition.
 * @param {Function} controllerClass - The resolved Minigame_Controller class.
 * @returns {() => Promise<{ assets: LoadingAssetEntry[], nextScene: string, nextSceneData: { session: RhythmSession } }>}
 *   The prepareCallback for LoadingState.
 */
export function buildRhythmPrepareCallback(definition, controllerClass) {
  return async () => {
    const session = buildRhythmSession(definition, controllerClass);
    return {
      assets: buildAssetManifest(definition),
      nextScene: 'RhythmScene',
      nextSceneData: { session }
    };
  };
}

/**
 * @fileoverview AssetManifestBuilder - Pure-function module that builds a flat
 * array of AssetEntry objects from a session and the three registries.
 * No Phaser dependency — fully unit-testable.
 */

import { resolveAssetPath } from '../utils/AssetPathResolver.js';

/**
 * @typedef {Object} AssetEntry
 * @property {'atlas'|'image'|'audio'} type
 * @property {string} key - Phaser cache key
 * @property {string} path - URL/path to the primary file (PNG or audio)
 * @property {string} [atlasURL] - URL to the XML file (for atlas type)
 */

const ASSET_PREFIX = 'assets/funkin.assets/';

/**
 * Prefix a resolved path with `assets/funkin.assets/` idempotently.
 * If the path already starts with the prefix, return it unchanged.
 * @param {string} resolvedPath
 * @returns {string}
 */
function prefixPath(resolvedPath) {
  if (!resolvedPath) return resolvedPath;
  if (resolvedPath.startsWith(ASSET_PREFIX)) return resolvedPath;
  return `${ASSET_PREFIX}${resolvedPath}`;
}

/**
 * Build character atlas entries for a set of character IDs.
 * @param {string[]} characterIds
 * @param {Object} characterRegistry
 * @returns {AssetEntry[]}
 */
export function buildCharacterEntries(characterIds, characterRegistry) {
  const entries = [];
  const seen = new Set();

  for (const id of characterIds) {
    if (seen.has(id)) continue;
    seen.add(id);

    const assetPath = characterRegistry.getAssetPath(id);
    if (!assetPath) {
      console.warn(`[AssetManifestBuilder] Character not found in registry: ${id}`);
      continue;
    }

    const resolved = resolveAssetPath(assetPath);
    if (!resolved) continue;

    const prefixed = prefixPath(resolved);
    entries.push({
      type: 'atlas',
      key: `char-${id}`,
      path: `${prefixed}.png`,
      atlasURL: `${prefixed}.xml`
    });
  }

  return entries;
}

/**
 * Build stage prop entries for a stage ID.
 * @param {string} stageId
 * @param {Object} stageRegistry
 * @returns {AssetEntry[]}
 */
export function buildStageEntries(stageId, stageRegistry) {
  const props = stageRegistry.getStageProps(stageId);
  if (!props || props.length === 0) {
    console.warn(`[AssetManifestBuilder] No props found for stage: ${stageId}`);
    return [];
  }

  const entries = [];

  for (const prop of props) {
    if (!prop.assetPath) continue;

    const resolved = resolveAssetPath(prop.assetPath);
    if (!resolved) continue;

    const prefixed = prefixPath(resolved);
    const hasAnimations = Array.isArray(prop.animations) && prop.animations.length > 0;

    if (hasAnimations) {
      entries.push({
        type: 'atlas',
        key: `stage-${stageId}-${prop.name}`,
        path: `${prefixed}.png`,
        atlasURL: `${prefixed}.xml`
      });
    } else {
      entries.push({
        type: 'image',
        key: `stage-${stageId}-${prop.name}`,
        path: `${prefixed}.png`
      });
    }
  }

  return entries;
}

/** Asset keys to resolve for note styles */
const NOTE_STYLE_ASSET_KEYS = ['note', 'noteStrumline', 'noteSplash', 'holdNote'];

/**
 * Build note style entries for a note style ID.
 * @param {string} noteStyleId
 * @param {Object} noteStyleRegistry
 * @returns {AssetEntry[]}
 */
export function buildNoteStyleEntries(noteStyleId, noteStyleRegistry) {
  const entries = [];

  for (const assetKey of NOTE_STYLE_ASSET_KEYS) {
    const asset = noteStyleRegistry.getResolvedAsset(noteStyleId, assetKey);
    if (!asset || !asset.resolvedPath) continue;

    const prefixed = prefixPath(asset.resolvedPath);
    entries.push({
      type: 'atlas',
      key: `notestyle-${noteStyleId}-${assetKey}`,
      path: `${prefixed}.png`,
      atlasURL: `${prefixed}.xml`
    });
  }

  return entries;
}

/**
 * Deduplicate entries by key, keeping the first occurrence.
 * @param {AssetEntry[]} entries
 * @returns {AssetEntry[]}
 */
export function deduplicateEntries(entries) {
  const seen = new Set();
  const result = [];

  for (const entry of entries) {
    if (seen.has(entry.key)) continue;
    seen.add(entry.key);
    result.push(entry);
  }

  return result;
}

/**
 * Build a complete asset manifest from a session object.
 * @param {Object} session - Output of LevelSessionBuilder.build()
 * @param {Object} registries - { characterRegistry, stageRegistry, noteStyleRegistry }
 * @returns {AssetEntry[]}
 */
export function buildManifest(session, registries) {
  const { characterRegistry, stageRegistry, noteStyleRegistry } = registries;
  const songData = session.songData || {};

  // Extract character IDs from the characters object (e.g. { player: 'bf', opponent: 'dad', girlfriend: 'gf' })
  const characters = songData.characters || {};
  const characterIds = Object.values(characters).filter(Boolean);

  const stageId = songData.stage;
  const noteStyleId = songData.noteStyle;

  // Start with existing audio assets from the session
  const audioEntries = session.assets || [];

  // Build entries from each registry
  const charEntries = characterIds.length > 0
    ? buildCharacterEntries(characterIds, characterRegistry)
    : [];

  const stageEntries = stageId
    ? buildStageEntries(stageId, stageRegistry)
    : [];

  const noteStyleEntries = noteStyleId
    ? buildNoteStyleEntries(noteStyleId, noteStyleRegistry)
    : [];

  // Merge all entries and deduplicate
  const allEntries = [...audioEntries, ...charEntries, ...stageEntries, ...noteStyleEntries];
  return deduplicateEntries(allEntries);
}

/**
 * Build an async prepareCallback for LoadingState that resolves a level into
 * a full asset manifest and session data for PlayState.
 *
 * @param {string|Object} levelInput - Level ID string or level object
 * @param {Object} registries - { characterRegistry, stageRegistry, noteStyleRegistry, levelSessionBuilder? }
 * @returns {(scene: Object) => Promise<{assets: AssetEntry[], nextSceneData: Object, nextScene: string}>}
 */
export function buildPrepareCallback(levelInput, registries) {
  return async (_scene) => {
    let builder = registries.levelSessionBuilder;
    if (!builder) {
      const { default: LevelSessionBuilder } = await import('./LevelSessionBuilder.js');
      builder = new LevelSessionBuilder();
    }
    const session = await builder.build(levelInput);
    const manifestEntries = buildManifest(session, registries);

    return {
      assets: manifestEntries,
      nextSceneData: {
        chart: session.chart,
        songData: session.songData,
        audio: session.audio,
        metadata: session.metadata
      },
      nextScene: 'PlayState'
    };
  };
}

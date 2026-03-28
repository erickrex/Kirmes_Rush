/**
 * @fileoverview AssetManifestBuilder - Pure-function module that builds a flat
 * array of AssetEntry objects from a session and the three registries.
 * No Phaser dependency — fully unit-testable.
 */

import { resolveAssetPath } from '../utils/AssetPathResolver.js';
import { SHARED_ASSET_ROOT } from '../utils/GameDataPaths.js';
import { createPreparedPlaySession } from './PreparedPlaySession.js';

/**
 * @typedef {Object} AssetEntry
 * @property {'atlas'|'image'|'audio'} type
 * @property {string} key - Phaser cache key
 * @property {string} path - URL/path to the primary file (PNG or audio)
 * @property {string} [atlasURL] - URL to the XML file (for atlas type)
 */

const ASSET_PREFIX = `${SHARED_ASSET_ROOT}/`;

/**
 * Prefix a resolved path with `assets/funkin.assets/` idempotently.
 * If the path already starts with the prefix, return it unchanged.
 * @param {string} resolvedPath
 * @returns {string}
 */
function prefixPath(resolvedPath) {
  if (!resolvedPath) {
    return resolvedPath;
  }
  if (resolvedPath.startsWith(ASSET_PREFIX)) {
    return resolvedPath;
  }
  return `${ASSET_PREFIX}${resolvedPath}`;
}

/**
 * Resolve a stage prop asset path, honoring the stage-level directory when
 * props use bare relative paths like `smokeRight` or `christmas/bgWalls`.
 * Week 1 keeps its legacy shared-image props in `shared/images/`.
 * @param {string} assetPath
 * @param {string|null} stageDirectory
 * @returns {string|null}
 */
function resolveStageAssetPath(assetPath, stageDirectory) {
  if (!assetPath) {
    return null;
  }

  if (assetPath.startsWith(ASSET_PREFIX) || assetPath.includes(':')) {
    return resolveAssetPath(assetPath);
  }

  if (stageDirectory === 'week1' && !assetPath.includes('/')) {
    return resolveAssetPath(assetPath);
  }

  if (stageDirectory) {
    return `${stageDirectory}/images/${assetPath}`;
  }

  return resolveAssetPath(assetPath);
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
    if (seen.has(id)) {
      continue;
    }
    seen.add(id);

    const assetPath = characterRegistry.getAssetPath(id);
    if (!assetPath) {
      console.warn(`[AssetManifestBuilder] Character not found in registry: ${id}`);
      continue;
    }

    const resolved = resolveAssetPath(assetPath);
    if (!resolved) {
      continue;
    }

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

  const stageDirectory = stageRegistry.getDirectory?.(stageId) ?? null;
  const entries = [];

  for (const prop of props) {
    if (!prop.assetPath || prop.assetPath.startsWith('#')) {
      continue;
    }

    const resolved = resolveStageAssetPath(prop.assetPath, stageDirectory);
    if (!resolved) {
      continue;
    }

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

const NOTE_STYLE_ASSET_KEYS = {
  note: 'atlas',
  noteStrumline: 'atlas',
  noteSplash: 'atlas',
  holdNote: 'image',
  countdownTwo: 'image',
  countdownOne: 'image',
  countdownGo: 'image',
  judgementSick: 'image',
  judgementGood: 'image',
  judgementBad: 'image',
  judgementShit: 'image',
  comboNumber0: 'image',
  comboNumber1: 'image',
  comboNumber2: 'image',
  comboNumber3: 'image',
  comboNumber4: 'image',
  comboNumber5: 'image',
  comboNumber6: 'image',
  comboNumber7: 'image',
  comboNumber8: 'image',
  comboNumber9: 'image'
};

/**
 * Build note style entries for a note style ID.
 * @param {string} noteStyleId
 * @param {Object} noteStyleRegistry
 * @returns {AssetEntry[]}
 */
export function buildNoteStyleEntries(noteStyleId, noteStyleRegistry) {
  const entries = [];

  for (const [assetKey, type] of Object.entries(NOTE_STYLE_ASSET_KEYS)) {
    const asset = noteStyleRegistry.getResolvedAsset(noteStyleId, assetKey);
    if (!asset || !asset.resolvedPath) {
      continue;
    }

    const prefixed = prefixPath(asset.resolvedPath);
    const entry = {
      type,
      key: `notestyle-${noteStyleId}-${assetKey}`,
      path: `${prefixed}.png`
    };

    if (type === 'atlas') {
      entry.atlasURL = `${prefixed}.xml`;
    }

    entries.push(entry);
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
    if (seen.has(entry.key)) {
      continue;
    }
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
  const features = session.level?.features ?? {};

  // Extract the playable character IDs from the prepared session contract.
  const characters = features.characters === false ? {} : songData.characters || {};
  const characterIds = ['player', 'opponent', 'girlfriend']
    .map((key) => characters[key])
    .filter((characterId) => typeof characterId === 'string' && characterId.length > 0);

  const stageId = features.stage === false ? null : songData.stage;
  const noteStyleId = songData.noteStyle;

  // Start with existing audio assets from the session
  const audioEntries = session.assets || [];

  // Build entries from each registry
  const charEntries =
    characterIds.length > 0 ? buildCharacterEntries(characterIds, characterRegistry) : [];

  const stageEntries = stageId ? buildStageEntries(stageId, stageRegistry) : [];

  const noteStyleEntries = noteStyleId ? buildNoteStyleEntries(noteStyleId, noteStyleRegistry) : [];

  // Guarantee the core note and strumline atlases are always loaded for the
  // default "funkin" style, even when the NoteStyleRegistry async load fails.
  // Without these the game falls back to generated placeholder shapes.
  const coreNoteStyleId = noteStyleId || 'funkin';
  const coreNoteKey = `notestyle-${coreNoteStyleId}-note`;
  const coreStrumKey = `notestyle-${coreNoteStyleId}-noteStrumline`;
  const hasCoreNote = noteStyleEntries.some((e) => e.key === coreNoteKey);
  const hasCoreStrum = noteStyleEntries.some((e) => e.key === coreStrumKey);

  if (!hasCoreNote) {
    noteStyleEntries.push({
      type: 'atlas',
      key: coreNoteKey,
      path: `${ASSET_PREFIX}shared/images/notes.png`,
      atlasURL: `${ASSET_PREFIX}shared/images/notes.xml`
    });
  }
  if (!hasCoreStrum) {
    noteStyleEntries.push({
      type: 'atlas',
      key: coreStrumKey,
      path: `${ASSET_PREFIX}shared/images/noteStrumline.png`,
      atlasURL: `${ASSET_PREFIX}shared/images/noteStrumline.xml`
    });
  }

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
  return async (scene) => {
    let builder = registries.levelSessionBuilder;
    if (!builder) {
      const { default: LevelSessionBuilder } = await import('./LevelSessionBuilder.js');
      builder = new LevelSessionBuilder();
    }
    const baseSession = await builder.build(levelInput);
    const characters = Object.values(baseSession.songData?.characters ?? {}).filter(Boolean);
    const uniqueCharacters = [...new Set(characters)];
    const stageId = baseSession.songData?.stage ?? null;
    const noteStyleId = baseSession.songData?.noteStyle ?? null;

    if (scene) {
      await Promise.all([
        uniqueCharacters.length > 0 &&
        typeof registries.characterRegistry?.loadEntriesAsync === 'function'
          ? registries.characterRegistry.loadEntriesAsync(scene, uniqueCharacters)
          : Promise.resolve(),
        stageId && typeof registries.stageRegistry?.loadEntriesAsync === 'function'
          ? registries.stageRegistry.loadEntriesAsync(scene, [stageId])
          : Promise.resolve(),
        noteStyleId && typeof registries.noteStyleRegistry?.loadEntriesAsync === 'function'
          ? registries.noteStyleRegistry.loadEntriesAsync(scene, [noteStyleId])
          : Promise.resolve()
      ]);
    }

    const manifestEntries = buildManifest(baseSession, registries);
    const session = createPreparedPlaySession({
      ...baseSession,
      assets: manifestEntries
    });

    return {
      assets: session.assets,
      nextSceneData: {
        levelId: session.level?.id ?? null,
        session
      },
      nextScene: 'PlayState'
    };
  };
}

/**
 * @fileoverview NoteStyleRegistry - Config-driven registry for note style/skin data
 * Manages loading and caching of note style definitions for Friday Night Funkin'.
 */

import { createRegistry } from '../../core/Registry.js';
import { resolveAssetPath } from '../../utils/AssetPathResolver.js';
import { getSharedRegistryPath } from '../../utils/GameDataPaths.js';

const DEFAULTS = {
  VERSION: '1.1.0',
  VERSION_RULE: '1.1.x',
  SCALE: 1,
  ALPHA: 1,
  OFFSETS: [0, 0]
};

const ASSET_KEYS = {
  NOTE: 'note',
  STRUMLINE: 'noteStrumline',
  HOLD_NOTE: 'holdNote',
  SPLASH: 'noteSplash',
  HOLD_COVER: 'holdNoteCover',
  COUNTDOWN_THREE: 'countdownThree',
  COUNTDOWN_TWO: 'countdownTwo',
  COUNTDOWN_ONE: 'countdownOne',
  COUNTDOWN_GO: 'countdownGo',
  JUDGEMENT_SICK: 'judgementSick',
  JUDGEMENT_GOOD: 'judgementGood',
  JUDGEMENT_BAD: 'judgementBad',
  JUDGEMENT_SHIT: 'judgementShit'
};

const DIRECTIONS = ['left', 'down', 'up', 'right'];

function cleanAssetData(asset) {
  return {
    assetPath: asset.assetPath || null,
    scale: asset.scale ?? DEFAULTS.SCALE,
    isPixel: asset.isPixel ?? false,
    offsets: asset.offsets || [...DEFAULTS.OFFSETS],
    alpha: asset.alpha ?? DEFAULTS.ALPHA,
    data: asset.data || {}
  };
}

const NoteStyleRegistry = createRegistry(
  {
    registryId: 'NOTESTYLE',
    dataFilePath: getSharedRegistryPath('notestyles'),
    versionRule: DEFAULTS.VERSION_RULE,
    entityName: 'Style',

    validateData(data, fileName) {
      if (!data.version) {
        console.warn(
          `[${this.registryId}] No version for: ${fileName}, assuming ${DEFAULTS.VERSION}`
        );
      }
      if (!data.assets || typeof data.assets !== 'object') {
        console.error(`[${this.registryId}] Missing or invalid assets for: ${fileName}`);
        return false;
      }
      return true;
    },

    cleanData(data) {
      const cleanedAssets = {};
      for (const [key, assetData] of Object.entries(data.assets)) {
        if (assetData) {
          cleanedAssets[key] = cleanAssetData(assetData);
        }
      }
      return {
        version: data.version || DEFAULTS.VERSION,
        name: data.name || 'Unnamed Style',
        author: data.author || null,
        fallback: data.fallback || null,
        assets: cleanedAssets
      };
    },

    createEntry(id, data) {
      return {
        id,
        data,
        name: data.name,
        fallback: data.fallback,
        assetKeys: Object.keys(data.assets),
        destroy: () => {}
      };
    }
  },
  {
    statics: { DEFAULTS, ASSET_KEYS, DIRECTIONS },
    methods: {
      getFallback(styleId) {
        const entry = this.fetchEntry(styleId);
        return entry ? entry.fallback : null;
      },
      getAsset(styleId, assetKey) {
        const entry = this.fetchEntry(styleId);
        if (!entry) {
          return null;
        }
        if (entry.data.assets[assetKey]) {
          return entry.data.assets[assetKey];
        }
        if (entry.fallback) {
          return this.getAsset(entry.fallback, assetKey);
        }
        return null;
      },
      getResolvedAsset(styleId, assetKey) {
        const asset = this.getAsset(styleId, assetKey);
        if (!asset) {
          return null;
        }
        return { ...asset, resolvedPath: this.resolveAssetPath(asset.assetPath) };
      },
      resolveAssetPath(assetPath) {
        return resolveAssetPath(assetPath);
      },
      hasAsset(styleId, assetKey) {
        return this.getAsset(styleId, assetKey) !== null;
      },
      getNoteData(styleId, direction) {
        const asset = this.getAsset(styleId, ASSET_KEYS.NOTE);
        if (!asset || !asset.data) {
          return null;
        }
        return asset.data[DIRECTIONS[direction]] || null;
      },
      getStrumlineData(styleId, direction, state) {
        const asset = this.getAsset(styleId, ASSET_KEYS.STRUMLINE);
        if (!asset || !asset.data) {
          return null;
        }
        return asset.data[`${DIRECTIONS[direction]}${state}`] || null;
      },
      getSplashData(styleId, direction) {
        const asset = this.getAsset(styleId, ASSET_KEYS.SPLASH);
        if (!asset || !asset.data) {
          return null;
        }
        return asset.data[`${DIRECTIONS[direction]}Splashes`] || null;
      },
      areSplashesEnabled(styleId) {
        const asset = this.getAsset(styleId, ASSET_KEYS.SPLASH);
        return asset?.data?.enabled ?? true;
      },
      getJudgementAsset(styleId, judgement) {
        const key = `judgement${judgement.charAt(0).toUpperCase() + judgement.slice(1)}`;
        return this.getAsset(styleId, key);
      },
      getComboNumberAsset(styleId, digit) {
        return this.getAsset(styleId, `comboNumber${digit}`);
      },
      getCountdownAsset(styleId, step) {
        return this.getAsset(styleId, `countdown${step}`);
      },
      getPixelStyles() {
        return this.getAllEntries().filter((entry) => entry.data.assets.note?.isPixel === true);
      },
      getStyleDisplayInfo(styleId) {
        const entry = this.fetchEntry(styleId);
        if (!entry) {
          return null;
        }
        const noteAsset = entry.data.assets.note;
        return {
          id: entry.id,
          name: entry.name,
          author: entry.data.author,
          fallback: entry.fallback,
          isPixel: noteAsset?.isPixel ?? false,
          assetCount: entry.assetKeys.length,
          hasSplashes: this.areSplashesEnabled(styleId)
        };
      },
      getAllAssetPaths(styleId) {
        const paths = new Set();
        const entry = this.fetchEntry(styleId);
        if (!entry) {
          return [];
        }
        for (const asset of Object.values(entry.data.assets)) {
          if (asset.assetPath) {
            const resolved = resolveAssetPath(asset.assetPath);
            if (resolved) {
              paths.add(resolved);
            }
          }
          if (asset.data) {
            this._collectNestedPaths(asset.data, paths);
          }
        }
        if (entry.fallback) {
          for (const path of this.getAllAssetPaths(entry.fallback)) {
            paths.add(path);
          }
        }
        return Array.from(paths);
      },
      _collectNestedPaths(data, paths) {
        if (!data || typeof data !== 'object') {
          return;
        }
        for (const value of Object.values(data)) {
          if (typeof value === 'object' && value !== null) {
            if (value.assetPath) {
              const r = resolveAssetPath(value.assetPath);
              if (r) {
                paths.add(r);
              }
            }
            if (value.audioPath) {
              const r = resolveAssetPath(value.audioPath);
              if (r) {
                paths.add(r);
              }
            }
            this._collectNestedPaths(value, paths);
          }
        }
      },
      toString() {
        return `NoteStyleRegistry(${this.countEntries()} styles)`;
      }
    }
  }
);

export default NoteStyleRegistry;

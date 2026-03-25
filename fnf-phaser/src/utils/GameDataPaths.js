/**
 * @fileoverview Canonical data roots for app-owned manifests and shared FNF assets.
 */

export const APP_DATA_ROOT = 'data';
export const APP_LEVELS_PATH = `${APP_DATA_ROOT}/levels`;
export const APP_MANIFESTS_PATH = `${APP_DATA_ROOT}/manifests`;

export const SHARED_ASSET_ROOT = 'assets/funkin.assets';
export const SHARED_DATA_ROOT = `${SHARED_ASSET_ROOT}/preload/data`;

/**
 * @param {string} registryName
 * @returns {string}
 */
export function getSharedRegistryPath(registryName) {
  return `${SHARED_DATA_ROOT}/${registryName}`;
}

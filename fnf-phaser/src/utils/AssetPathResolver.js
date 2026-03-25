/**
 * @fileoverview Shared asset path resolution utility.
 * Resolves prefixed asset paths (shared:, default:, custom prefix:) to filesystem paths.
 * Used by NoteStyleRegistry, StageRegistry, and CharacterRegistry.
 */

/**
 * Resolves a prefixed asset path to a filesystem path.
 *
 * - `shared:<path>` → `images/shared/<path>`
 * - `default:<path>` → `images/preload/<path>`
 * - `<prefix>:<path>` → `images/<prefix>/<path>`
 * - `<path>` (no colon) → `images/<path>`
 * - `null` or empty → `null`
 *
 * Only splits on the first colon, so `prefix:path:extra` resolves to `images/prefix/path:extra`.
 *
 * @param {string|null} assetPath
 * @returns {string|null}
 */
export function resolveAssetPath(assetPath) {
  if (!assetPath) return null;
  if (assetPath.startsWith('shared:')) return `images/shared/${assetPath.slice(7)}`;
  if (assetPath.startsWith('default:')) return `images/preload/${assetPath.slice(8)}`;
  const colonIndex = assetPath.indexOf(':');
  if (colonIndex !== -1) {
    const prefix = assetPath.slice(0, colonIndex);
    const path = assetPath.slice(colonIndex + 1);
    return `images/${prefix}/${path}`;
  }
  return `images/${assetPath}`;
}

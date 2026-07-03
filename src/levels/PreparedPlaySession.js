/**
 * @fileoverview PreparedPlaySession helpers for the current 5-level release path.
 */

/** @import { PreparedPlaySession } from '../types.js' */

/**
 * Normalize arbitrary play-scene data into the prepared-session contract used by
 * the shipped five-level flow.
 *
 * @param {Partial<PreparedPlaySession> | null | undefined} session
 * @returns {PreparedPlaySession}
 */
export function createPreparedPlaySession(
  session = /** @type {Partial<PreparedPlaySession>} */ ({})
) {
  const s = session || {};
  const difficulty = s.difficulty ?? /** @type {any} */ (s.songData)?.difficulty ?? 'normal';

  return {
    level: s.level ?? null,
    difficulty,
    chart: s.chart ?? null,
    songData: s.songData ?? null,
    audio: s.audio ?? null,
    assets: Array.isArray(s.assets) ? [...s.assets] : [],
    metadata: s.metadata ?? null
  };
}

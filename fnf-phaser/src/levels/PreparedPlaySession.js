/**
 * @fileoverview PreparedPlaySession helpers for the current 5-level release path.
 */

/**
 * @typedef {Object} PreparedPlaySession
 * @property {Object | null} level
 * @property {string} difficulty
 * @property {Object | null} chart
 * @property {Object | null} songData
 * @property {Object | null} audio
 * @property {Object[]} assets
 * @property {Object | null} metadata
 */

/**
 * Normalize arbitrary play-scene data into the prepared-session contract used by
 * the shipped five-level flow.
 *
 * @param {Partial<PreparedPlaySession> | null | undefined} session
 * @returns {PreparedPlaySession}
 */
export function createPreparedPlaySession(session = {}) {
  const difficulty = session.difficulty ?? session.songData?.difficulty ?? 'normal';

  return {
    level: session.level ?? null,
    difficulty,
    chart: session.chart ?? null,
    songData: session.songData ?? null,
    audio: session.audio ?? null,
    assets: Array.isArray(session.assets) ? [...session.assets] : [],
    metadata: session.metadata ?? null
  };
}

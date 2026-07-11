/**
 * @fileoverview RhythmCharacterAnimations - registers Phaser animations for the
 * rhythm minigame characters from the committed FNF Sparrow atlases (R13.3), so
 * the Minigame_Controllers' pose requests (`idle` / `cheer` / `hey`) actually
 * animate instead of showing a static first frame.
 *
 * No new art is introduced (R13.4): every pose maps to frames that already ship
 * in `assets/rythm-foundation.assets/shared/images/characters/` —
 * `BOYFRIEND.{png,xml}` (bf), `GF_assets.{png,xml}` (gf), and
 * `daddyDearest.{png,xml}` (dad). daddyDearest has no distinct "cheer"/"hey"
 * frames, so those poses reuse its `singUP` frames per the prototype decision.
 *
 * Animations are registered under keys namespaced by atlas
 * (`rhythm-<atlasKey>-<pose>`, see {@link rhythmAnimKey}) so the three
 * characters can each own an `idle`/`cheer`/`hey` animation without the global
 * Phaser animation manager colliding on a shared name.
 *
 * Frame lists are built from the atlas at runtime via
 * `textures.get(key).getFrameNames()` (the same reliable pattern TitleState uses
 * for the GF dancer), filtered to the frames whose name is exactly
 * `<prefix><digits>` so overlapping prefixes (e.g. "GF Dancing Beat" vs
 * "GF Dancing Beat Hair blowing") never bleed into one animation.
 *
 * All entry points are guarded and idempotent: they no-op cleanly when the
 * scene lacks a real Phaser animation/texture manager (headless tests) and skip
 * animations already registered, so repeated `create()`s across runs are safe.
 */

/**
 * The logical poses every rhythm Minigame_Controller may request.
 * @type {readonly ['idle', 'cheer', 'hey']}
 */
export const RHYTHM_POSES = Object.freeze(['idle', 'cheer', 'hey']);

/**
 * Per-atlas mapping from a logical pose to the Sparrow atlas frame-name prefix
 * that backs it. Prefixes match the committed atlas XML exactly.
 * @type {Readonly<Record<string, Record<string, string>>>}
 */
const POSE_FRAME_PREFIXES = Object.freeze({
  bf: { idle: 'BF idle dance', cheer: 'BF HEY!!', hey: 'BF HEY!!' },
  gf: { idle: 'GF Dancing Beat', cheer: 'GF Cheer', hey: 'GF Cheer' },
  dad: { idle: 'idle', cheer: 'singUP', hey: 'singUP' }
});

/**
 * Poses that loop continuously. Only `idle` loops: it is the resting pose every
 * controller returns to. `cheer` and `hey` are momentary cue/reaction poses that
 * play once and settle back to `idle` on completion (see the reaction handlers
 * in the concrete controllers), so they must not be registered as looping — a
 * looping reaction never fires `animationcomplete` and would freeze the sprite
 * mid-cheer instead of pulsing once per beat.
 * @type {Set<string>}
 */
const LOOPED_POSES = new Set(['idle']);

/**
 * Playback rate (fps) for the registered character animations.
 * @type {number}
 */
const FRAME_RATE = 24;

/**
 * Build the namespaced Phaser animation key for an atlas + pose.
 * @param {string} atlasKey - The atlas cache key (e.g. `bf`, `gf`, `dad`).
 * @param {string} pose - A logical pose from {@link RHYTHM_POSES}.
 * @returns {string} The namespaced animation key, e.g. `rhythm-bf-idle`.
 */
export function rhythmAnimKey(atlasKey, pose) {
  return `rhythm-${atlasKey}-${pose}`;
}

/**
 * Collect the atlas frame names that belong to a single animation prefix, in
 * frame order. A frame belongs to `prefix` only when the remainder after the
 * prefix is purely digits, so a prefix never captures a longer sibling prefix's
 * frames.
 * @param {string[]} allFrames - Every frame name in the atlas.
 * @param {string} prefix - The animation frame-name prefix.
 * @returns {string[]} The matching frame names, sorted in frame order.
 */
function framesForPrefix(allFrames, prefix) {
  return allFrames
    .filter((name) => name.startsWith(prefix) && /^\d+$/.test(name.slice(prefix.length)))
    .sort();
}

/**
 * Register the `idle`/`cheer`/`hey` animations for one character atlas from its
 * committed frames (R13.3). Idempotent and headless-safe: it no-ops when the
 * scene has no real animation/texture manager or the atlas is not loaded, and
 * skips poses that are already registered or whose frames are absent.
 * @param {Object|null} scene - The owning scene (RhythmScene or a mock).
 * @param {string} atlasKey - The atlas cache key (`bf`, `gf`, or `dad`).
 * @returns {string[]} The animation keys that exist for this atlas after the call.
 */
export function registerRhythmCharacterAnims(scene, atlasKey) {
  /** @type {string[]} */
  const ready = [];

  const prefixes = POSE_FRAME_PREFIXES[atlasKey];
  if (!prefixes) {
    return ready;
  }

  const anims = /** @type {any} */ (scene) && /** @type {any} */ (scene).anims;
  const textures = /** @type {any} */ (scene) && /** @type {any} */ (scene).textures;
  if (
    !anims ||
    typeof anims.create !== 'function' ||
    typeof anims.exists !== 'function' ||
    !textures ||
    typeof textures.exists !== 'function' ||
    typeof textures.get !== 'function'
  ) {
    return ready;
  }

  if (!textures.exists(atlasKey)) {
    return ready;
  }

  const texture = textures.get(atlasKey);
  const allFrames =
    texture && typeof texture.getFrameNames === 'function' ? texture.getFrameNames() : [];
  if (!Array.isArray(allFrames) || allFrames.length === 0) {
    return ready;
  }

  for (const pose of RHYTHM_POSES) {
    const key = rhythmAnimKey(atlasKey, pose);
    if (anims.exists(key)) {
      ready.push(key);
      continue;
    }

    const frameNames = framesForPrefix(allFrames, prefixes[pose]);
    if (frameNames.length === 0) {
      continue;
    }

    anims.create({
      key,
      frames: frameNames.map((frame) => ({ key: atlasKey, frame })),
      frameRate: FRAME_RATE,
      repeat: LOOPED_POSES.has(pose) ? -1 : 0
    });
    ready.push(key);
  }

  return ready;
}

export default registerRhythmCharacterAnims;
export { POSE_FRAME_PREFIXES };

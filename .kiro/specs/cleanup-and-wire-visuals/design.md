# Design Document: Cleanup and Wire-In Visual Features

## Overview

This design implements three workstreams against `fnf-phaser`:

1. **Delete** confirmed dead code (`levels/index.js`, empty `src/util/`, `SongRegistry`, `SparrowParser`) and dead exports.
2. **Wire in** the four orphaned visual features (`ComboPopup`, `NoteSplash`, `HealthIcon`, `Transitions`) so they render in the live runtime.
3. **Consolidate** gameplay state into a single owner (`GameplayState_Module`) and split the Phaser bundle.

The central design constraint, discovered during review, is that **three of the four visual classes do not currently create Phaser game objects**:

- `ComboPopup` and `NoteSplash` are headless pool/lifecycle managers. They track sprite *data* (`x`, `y`, `alpha`, `scale`, `rotation`, `visible`, `lifetime`) but never call `scene.add.*`. Wiring them in requires giving them a real rendering backing.
- `HealthIcon` extends `FunkinSprite` (so it *is* a real game object) but its `loadLegacyIcon()` / `setupLegacyAnimations()` are stubs that load no texture.
- `Transitions` is fully render-capable already (it uses `scene.add.graphics()`, tweens, overlays) and only needs to be invoked.

The approach mirrors the existing `GeneratedGameplaySkin` precedent: prefer real loaded note-style/character assets when present, and fall back to **generated placeholder textures** (or Phaser `Text` for combo/judgement labels) so a visible result is guaranteed without depending on an asset pipeline that may be incomplete.

## Research Summary

Findings that shaped this design (verified by reading source):

- **Entry/scene wiring**: `src/main.js` registers scenes; `PlayScene` (`src/scenes/PlayScene.js`) creates a `PlayState` (`src/play/PlayState.js`). PlayState already creates `_cameraController` exposing `camHUD`, and HUD elements (`ScoreDisplay`, `HealthBar`) are created with HUD-camera registration.
- **Hit pipeline**: `NoteProcessor.hitNote()` computes `judgement`/`noteScore`, mutates `playState.*` directly, emits `Events.NOTE_HIT`, and calls `playState.onNoteHit`. A separate `onNoteHitEvent` listener (also in NoteProcessor) calls `gameplayState.updateScore/updateCombo/updateTallies/updateHealth` — this is the parallel bookkeeping to be collapsed.
- **Combo-break logic** exists in three places: `Scoring.doesJudgementBreakCombo`, `GameplayState.updateCombo`, and inline in `NoteProcessor.hitNote`. `Scoring.doesJudgementBreakCombo` is the canonical one.
- **Receptors**: `Strumline` exposes `receptors` with `x`/`y` and `getXPos(direction)`; `GeneratedGameplaySkin` positions receptors at `strumline.y + RECEPTOR_Y_OFFSET`. Splashes should spawn at the player strumline receptor positions.
- **Transitions integration point**: `BaseMenuState.transitionToScene(sceneKey, data)` does `cameras.main.fadeOut(500,...)` then `scene.start`. Nearly every menu/return path funnels through here or replicates it. This is the single best integration seam.
- **Health icon data**: `CharacterRegistry.getHealthIconData(charId)` returns `{ id, scale, isPixel, offsets, flipX }`. `HealthIcon.configure(data)` already consumes this shape.
- **Song loading** does NOT use `SongRegistry`; it uses `LevelSessionBuilder` → `ChartParser` → `LevelContentResolver.fetchJson`. Deleting `SongRegistry`/`SparrowParser` is safe.

## Architecture

### Component diagram (gameplay HUD after wiring)

```
PlayState
 ├─ _cameraController ── camHUD (scrollFactor-0 layer)
 ├─ _gameplayState  ◄── single source of truth (health/score/combo/tallies)
 ├─ _noteProcessor  ──► updates state via _gameplayState only
 │        │ emits NOTE_HIT { judgement, score, combo, direction, receptor }
 │        ▼
 ├─ comboPopup  (HUD)   ◄ showJudgement(judgement, combo, x, y)
 ├─ noteSplash  (game/HUD) ◄ spawnAtReceptor(receptor, direction)  [sick/killer only]
 ├─ healthBar
 │   ├─ playerIcon  (HealthIcon, HUD)
 │   └─ opponentIcon(HealthIcon, HUD)
 └─ update(delta): comboPopup.update / noteSplash.update / icons.update
```

### Rendering strategy for headless managers

`ComboPopup` and `NoteSplash` currently store plain data objects in their active/pool arrays. The minimal-risk way to make them render while preserving their tested pooling logic is to **attach a Phaser game object to each pooled record and sync it in `update()`** rather than rewriting the pooling.

Design choice: extend the existing classes (not a separate adapter) so their public API and tests stay intact:

- Add a private `ensureGameObject(record)` that lazily creates the Phaser object (`scene.add.text(...)` for combo/judgement labels, or `scene.add.image/sprite(...)` for splashes using a generated/loaded texture) when the scene is present.
- In `update(delta)`, after the existing lifetime math, sync `gameObject.setPosition/ setAlpha/ setScale/ setRotation/ setVisible` from the record. When a record is recycled to the pool, set its game object `visible = false` (reused on next spawn).
- In `destroy()`, destroy all game objects in active + pool arrays.
- Guard every game-object call behind `this.scene?.add` so existing headless unit tests (which pass a minimal/no scene) keep working. Tests that pass no `add` capability exercise the pure data path unchanged.

This keeps the 42 existing ComboPopup tests and 42 NoteSplash tests valid (they assert on data state, counts, pooling), and adds rendering only when a real scene is present.

### HealthIcon texture strategy

`HealthIcon extends FunkinSprite`. To guarantee visibility:

- A small helper (in PlayState HUD setup or a tiny `HealthIconTextures` utility) checks whether a real icon texture key exists in `scene.textures`. If yes, set it. If not, generate a circular placeholder texture (color derived from player/opponent) via the Generated_Texture_Pattern and assign it.
- `configure(getHealthIconData(charId))` sets scale/offsets/flip. `updateHealthIcon(health)` and `updatePosition(healthBar)` are already implemented and just need to be called from the update loop; `bop()` is driven from the existing beat event the HUD already listens to (Conductor beat / `Events`).

### Transitions integration

Introduce the Transitions instance at the `BaseMenuState` level so all menu scenes share one mechanism:

- `BaseMenuState.create()` (or lazy getter) constructs `this.transitions = new Transitions(this)` and optionally plays `transitionIn` on entry.
- `transitionToScene(sceneKey, data)` becomes: guard, `await this.transitions.transitionOut({...})`, then `this.scene.start(sceneKey, data)`. Because `transitionOut` returns a promise, the existing `camerafadeoutcomplete` callback pattern is replaced by awaiting the promise (or chaining `.then`).
- `shutdown()` calls `this.transitions?.destroy()`.
- Scenes outside `BaseMenuState` that replicate the fade (e.g., `ReplayBrowserState`, `GameOverState`, `ResultState`, `TitleState`) are migrated to the same helper where they extend BaseMenuState; for non-BaseMenuState scenes, a thin local Transitions instance is used with the same contract. To bound scope, the default transition type remains a fade (visually equivalent to today) so behavior/tests are preserved; fancier types are opt-in per scene.

Risk control: keep the default transition a 500ms fade so the observable behavior (and any tests asserting `fadeOut` timing or eventual `scene.start`) changes as little as possible. Where a test asserts directly on `cameras.main.fadeOut`, the design prefers having Transitions' fade drive `cameras.main.fadeOut` internally OR updating that test to assert on the navigation outcome (target scene + data), which is the meaningful contract.

### Single source of truth for gameplay state

Collapse the parallel bookkeeping:

1. Make `GameplayState_Module` authoritative. PlayState's `score`/`combo`/`maxCombo`/`health`/`tallies` become **getters** that read from `_gameplayState` (preserving the public read API used by HUD/result code and tests).
2. In `NoteProcessor.hitNote()` and `missNote()`, remove the direct `playState.score += ...`, `playState.combo = ...`, tally mutation, and inline health clamp. Replace with calls to the GameplayState methods (`updateScore`, `updateCombo`, `updateTallies`, `updateHealth`) — the same methods the `onNoteHitEvent` path already uses.
3. Remove the now-redundant `Events.NOTE_HIT` *self-listener* double-update: choose one path. Decision: keep the **direct call** path inside `hitNote()` (so hit handling is synchronous and ordered) and make `onNoteHitEvent`/`onNoteMissEvent` no longer re-apply state (they may remain for *display-only* concerns like stats, or be removed if unused). This guarantees exactly-once updates.
4. Delete inline combo-break logic in NoteProcessor; rely on `GameplayState.updateCombo(judgement)` which calls `Scoring.doesJudgementBreakCombo`.
5. The `Events.NOTE_HIT` emit is retained (ComboPopup/NoteSplash/stats subscribe to it or PlayState triggers them in `onNoteHit`), but its payload is extended with `direction` and the hit `receptor` so visual features can position effects.

This preserves externally observable behavior (final score/rank/accuracy/tallies) while removing the duplicate counting.

### Bundle chunking

In `vite.config.js`, add:

```js
build: {
  rollupOptions: {
    output: {
      manualChunks(id) {
        if (id.includes('node_modules/phaser')) return 'phaser';
      }
    }
  }
}
```

This isolates the ~1.6MB engine into a `phaser` chunk; the application chunk drops below the 1500kB warning threshold.

## Components and Interfaces

### Modified: `ComboPopup`
- New private: `ensureGameObject(record)`, `syncGameObject(record)`.
- `update(delta)` syncs game objects after lifetime math.
- `destroy()` destroys all game objects. Public API otherwise unchanged.

### Modified: `NoteSplash`
- New private: texture acquisition (loaded splash asset or generated burst), `ensureGameObject(splash)`, sync in `update`.
- `destroy()` destroys game objects. Public API unchanged.

### Modified: `HealthIcon` usage (no API change to the class)
- PlayState HUD setup creates player/opponent icons, configures from registry, assigns texture (real or generated), and updates them per frame + on beat.

### Modified: `BaseMenuState`
- Owns a `Transitions` instance; `transitionToScene` routes through it; `shutdown` destroys it.

### Modified: `PlayState`
- Creates/updates/destroys `comboPopup`, `noteSplash`, and two `HealthIcon`s.
- `score`/`combo`/`maxCombo`/`health`/`tallies` become read accessors over `_gameplayState`.
- `onNoteHit(note, judgement, score, timing)` triggers combo popup + splash (splash only on sick/killer).

### Modified: `NoteProcessor`
- `hitNote`/`missNote` mutate state only via GameplayState methods.
- `NOTE_HIT` payload includes `{ direction, receptor }`.

### Deleted
- `src/levels/index.js`, `src/util/` (dir), `src/data/registries/SongRegistry.js`, `tests/SongRegistry.test.js`, `src/data/parsers/SparrowParser.js`, `tests/SparrowParser.test.js`.
- `MANIFEST_BASE_PATH` export (and possibly granular `AssetManifestBuilder` exports per Requirement 7).

## Data Models

`NOTE_HIT` event payload (extended):
```
{ note, judgement: string, score: number, timing: number, combo: number,
  direction: number, receptor: { x: number, y: number } | null }
```

PlayState state accessors (read-through to GameplayState):
```
get score()    -> _gameplayState.score
get combo()    -> _gameplayState.combo
get maxCombo() -> _gameplayState.maxCombo
get health()   -> _gameplayState.health
get tallies()  -> _gameplayState.tallies
```
(If existing code assigns to `playState.health = ...` outside the hit path, those assignments are redirected to `_gameplayState` setters/methods or replaced.)

## Error Handling

- All new rendering code guards on `this.scene?.add` / `scene.textures?.exists` so headless test environments and teardown races do not throw.
- Transitions integration uses the existing `cancel()`/`destroy()` to handle interruption during `shutdown` without throwing.
- Generated-texture helpers no-op when `scene` is null.

## Testing Strategy

- **Reuse existing unit tests** for ComboPopup, NoteSplash, HealthIcon, Transitions (data/lifecycle assertions remain valid; rendering is additive and guarded).
- **Add focused tests** for: ComboPopup/NoteSplash creating and destroying game objects when a scene with `add` is provided; PlayState wiring (combo popup invoked on hit, splash only on sick/killer, icons created/destroyed); single-source-of-truth (a simulated hit updates state exactly once; PlayState read accessors equal GameplayState values).
- **Update** `PlayState.test.js` / `NoteProcessor.test.js` only as needed for the single-owner contract; preserve behavioral assertions (final score/combo/tallies).
- **Delete** `SongRegistry.test.js` and `SparrowParser.test.js` with their modules.
- **Verification_Gates** (`lint`, `typecheck`, `test`, `test:integration`, `build`) must all pass at each checkpoint.
- Property tests (optional, fast-check): exactly-once state update invariant under random hit/miss sequences; pool never leaks (active+pool count conserved) for ComboPopup/NoteSplash.

## Correctness Properties

These invariants must hold after implementation and are good candidates for property-based tests (fast-check):

### Property 1: Exactly-once state update
For any sequence of note hits/misses, the totals tracked by GameplayState_Module equal the sum of per-event contributions (no double counting). **Validates: Requirements 6.4.**

### Property 2: Read-through consistency
For all gameplay-state reads, `PlayState.score/combo/maxCombo/health/tallies` are always equal to the corresponding `GameplayState_Module` values. **Validates: Requirements 6.1, 6.3.**

### Property 3: Behavioral invariance
For identical input sequences, final score, rank, accuracy, and tallies are identical before and after the single-owner refactor. **Validates: Requirements 6.6.**

### Property 4: Single combo-break authority
The combo-break outcome for any judgement equals `Scoring.doesJudgementBreakCombo(judgement)`. **Validates: Requirements 6.5.**

### Property 5: Pool conservation (ComboPopup/NoteSplash)
At all times, `active.length + pool.length` is conserved across spawn/recycle cycles, and no Phaser game object is leaked (every recycled record's game object is hidden, not re-created). **Validates: Requirements 2.4, 3.3.**

### Property 6: Splash gating
A splash game object is spawned only when judgement ∈ {sick, killer} and splashes are enabled. **Validates: Requirements 3.2, 3.4.**

### Property 7: Transition navigation preservation
For every `transitionToScene(sceneKey, data)` call, the eventual scene started is `sceneKey` with payload `data`, regardless of transition animation. **Validates: Requirements 5.5.**

### Property 8: Teardown safety
Destroying any wired feature (ComboPopup, NoteSplash, HealthIcon, Transitions) during an in-flight animation/transition throws no error and destroys all owned game objects/overlays. **Validates: Requirements 2.7, 3.6, 4.6, 5.4, 5.6.**

## Implementation Notes / Risks

- The biggest scope risk is the headless→rendered conversion of ComboPopup/NoteSplash. Keeping the pooling data model and only *attaching* game objects bounds the change and protects existing tests.
- Transitions migration could ripple across many scenes. Mitigation: centralize in `BaseMenuState`, keep default fade timing/visuals equivalent, and migrate non-BaseMenuState scenes only with the same fade contract.
- The single-source-of-truth change must not alter final scores. Mitigation: route every mutation through the already-tested GameplayState methods and verify against existing Scoring/PlayState behavioral tests.

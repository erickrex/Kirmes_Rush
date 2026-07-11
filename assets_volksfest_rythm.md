# Volksfest Rhythm — Asset Generation Spec

Comprehensive list of every graphic asset required to reskin the four rhythm
minigames with an original **Volksfest / Kirmes (German funfair)** look, so the
game no longer depends on any Friday Night Funkin' (FNF) art.

> **Scope decision (per request):** We stop shipping **all** FNF graphics
> (characters, judgement popups, UI). We **keep the FNF audio only** — the song
> `.ogg`/`.mp3` tracks referenced by the minigame definitions are retained as-is.
> Everything visual in this document is net-new art to generate.

---

## 1. Hard constraints

| Constraint | Value | Source |
|---|---|---|
| Canvas resolution | **720 × 1280 px** (portrait) | `src/main.js` game config |
| Scale mode | `Phaser.Scale.FIT` + `CENTER_BOTH` (whole canvas is letterboxed/upscaled to the device) | `src/main.js` |
| Rendering | `antialias: true`, `pixelArt: false` (smooth art, **not** pixel art) | `src/main.js` |
| Background clear color | `#000000` | `src/main.js` |
| Orientation | Portrait only (a DOM overlay blocks landscape) | `OrientationOverlay` |

**Authoring guidance.** Because `FIT` upscales the 720×1280 canvas on most
phones (many are 1080-wide+), author all raster art at **2× the target render
size** and let Phaser downscale. Target render sizes below are given at 1× (the
logical canvas); multiply by 2 for the source file.

---

## 2. Asset pipeline conventions

The rhythm loader (`src/rhythm/data/RhythmSessionBuilder.js`) accepts exactly
three asset entry types. Match these formats or the manifest builder rejects the
definition.

### 2.1 `atlas` — animated actors (Sparrow/Starling XML)
```json
{ "type": "atlas", "key": "…", "texture": "path/to/sheet.png", "atlas": "path/to/sheet.xml" }
```
- **Texture:** single PNG-32 (RGBA, straight alpha, sRGB).
- **Atlas XML:** Sparrow/Starling format (`<TextureAtlas><SubTexture name= x= y= width= height= .../>`), the same format TexturePacker exports as "Sparrow". Trimmed frames with `frameX/frameY/frameWidth/frameHeight` are supported.
- **Frame naming is critical.** Animations are built by frame-name **prefix + zero-padded index**, e.g. `steinFill0000`, `steinFill0001`, … The registrar (`RhythmCharacterAnimations.js`) only groups frames whose name is exactly `<prefix><digits>`. Keep 4-digit indices (`0000`) to match the existing convention.

### 2.2 `image` — static single images (popups, icons)
```json
{ "type": "image", "key": "…", "path": "path/to/image.png" }
```
- Single PNG-32 with transparency.

### 2.3 `audio` — **retained FNF tracks, do not regenerate**
Injected automatically from the definition's `song.id`. No art work.

### 2.4 Suggested folder layout
```
assets/volksfest.assets/
  characters/     # actor atlases (png + xml)
  objects/        # balls, steins, hammers, targets (atlas or image)
  ui/
    popup/        # judgement popups
    hud/          # beat pulse, meter frames, instruction chrome
    select/       # minigame select icons + background
  backgrounds/    # per-minigame scene backgrounds
```

---

## 3. Pose / animation model (framework limit)

The framework registers **exactly three named poses per actor atlas**:
`idle`, `cheer`, `hey` (see `RHYTHM_POSES` in `RhythmCharacterAnimations.js`).
`idle` **loops**; `cheer` and `hey` are **one-shot** reactions that settle back
to `idle` on completion (this was just fixed).

So each actor needs **at most three animation clips**. Below, each minigame maps
those three logical slots to a mechanic-specific meaning. If a mechanic needs a
4th distinct pose, that requires a small code change to `RHYTHM_POSES` +
`POSE_FRAME_PREFIXES` — flagged where relevant.

**Frame-rate:** clips play at 24 fps (`FRAME_RATE`). Author idle as a seamless
loop (4–8 frames is plenty); reactions as 3–6 frame one-shots.

---

## 4. On-screen layout reference (computed for 720×1280)

Every position below is derived from the controllers' `create()` methods. Use it
to size art so it doesn't overlap or clip in portrait.

| Element | Minigame | Center (x, y) px | Render size (px) |
|---|---|---|---|
| Instruction banner (text) | all | 360, 115 | wrap width ~620 |
| Beat pulse indicator | all | 360, 192 | ⌀ ~29 (radius 14) |
| Cue prompt "TAP!/…" (text) | all | 360, 256 | 64px font |
| Judgement popup | tap/flick/fill/release | 360, ~384–448 | see §5.2 |
| Leader (actor) | tap-clap | 216, 742 | ~384 tall |
| Clapper/player (actor) | tap-clap | 504, 742 | ~384 tall |
| Server (actor) | flick-rally | 360, 333 | ~256 tall |
| Player (actor) | flick-rally | 360, 947 | ~282 tall |
| Ball / throwable | flick-rally | travels 360,461 → 360,819 | ~43 sq (replace primitive) |
| Bot (actor) | fill-bot | 360, 486 | ~282 tall |
| Player (actor) | fill-bot | 360, 794 | ~307 tall |
| Fill meter | fill-bot | 360, 1050 | 504 × 51 (replace primitive) |
| Coach (actor) | release-cue | 360, 461 | ~282 tall |
| Player (actor) | release-cue | 360, 768 | ~307 tall |
| Charge meter + release marker | release-cue | 360, 1050 | 504 × 51, marker ~7 × 82 (replace primitive) |

> "Replace primitive" = currently drawn as a colored rectangle/circle in code.
> Turning these into art requires swapping the `_addRect`/`_addCircle` calls for
> `_addImage`/`_addSprite` in the relevant controller.

---

## 5. Shared assets (used by every minigame)

### 5.1 Per-minigame scene backgrounds
Portrait full-bleed funfair backdrops. Author to **720 × 1280 (2× = 1440 × 2560)**.
Keep the vertical center band (y ≈ 300–1050) relatively calm so actors, meters,
and popups stay readable on top.

| Key | Theme suggestion | Type |
|---|---|---|
| `bg-tapclap` | Bandstand / Blaskapelle tent, bunting, warm evening lights | image |
| `bg-fillbot` | Beer tent (Bierzelt) interior, tap counter | image |
| `bg-release` | Shooting gallery / Schießbude stall | image |
| `bg-flick` | Throwing stall (Wurfbude) with prize wall | image |

*(Optional cost-saver: one shared `bg-volksfest` fairground backdrop reused by
all four. Listed as 4 for maximum polish; collapse to 1 if budget-limited.)*

### 5.2 Judgement popups (replaces FNF `sick/good/bad/shit`)
Shown centered around y≈384–448. Four tiers. Author each ~**360 × 160 (2× = 720 × 320)**,
transparent, bold enough to read at a glance over a busy background.

| Key | Judgement tier | Suggested German-fair wording |
|---|---|---|
| `popup-perfect` | perfect | "PERFEKT!" |
| `popup-good` | good | "GUT!" |
| `popup-barely` | barely | "OKAY" |
| `popup-miss` | miss | "DANEBEN" |

> Keep the four cache keys mapping stable; controllers reference `popup-sick /
> popup-good / popup-bad / popup-shit` today. Either keep those keys or rename in
> all four controllers' `*_ASSETS.popups` maps + the definition JSON.

### 5.3 HUD chrome
| Key | Purpose | Render size | Type | Notes |
|---|---|---|---|---|
| `hud-beat-pulse` | Tempo indicator at (360,192), pulses each beat | ⌀ ~32 (2× = 64) | image | Replaces the generated yellow circle. A festival lightbulb / lantern reads well. |
| `hud-instruction-panel` | Optional backing plate behind the instruction text at (360,115) | ~660 × 90 | image (9-slice friendly) | Optional; improves legibility vs text-on-background. |
| `hud-cue-burst` | Optional flourish behind the "act now" cue prompt at (360,256) | ~420 × 200 | image | Optional. |

### 5.4 Minigame Select screen (`MinigameSelectState`)
Currently a text list on a gradient. Recommended additions for legibility:

| Key | Purpose | Render size | Type |
|---|---|---|---|
| `select-bg` | Fairground select backdrop | 720 × 1280 | image |
| `icon-tapclap` | List icon for Tap-Clap | ~120 × 120 | image |
| `icon-fillbot` | List icon for Fill (stein) | ~120 × 120 | image |
| `icon-release` | List icon for Release (slingshot) | ~120 × 120 | image |
| `icon-flick` | List icon for Flick (toss) | ~120 × 120 | image |
| `ui-back-arrow` | Back button glyph (replaces "← Back" text) | ~48 × 48 | image |

> Adding icons requires small edits to `createMinigameTexts()` /
> `createStaticUi()` to place images next to each entry. Text-only will still
> work if you skip these.

---

## 6. Per-minigame assets

Each minigame has **two actor atlases** + its **interactive object(s)** +
**background** (in §5.1). Actors follow the 3-pose model (§3).

### 6.1 Tap-Clap — "Klatsch mit!" (clap on the beat)
Mechanic: leader cues a beat, player taps anywhere on the beat.
Theme: a **bandleader / Kapellmeister** cues; the player is a **clapping
spectator** (or a big pair of clapping hands).

**Actor `tapclap-leader`** (atlas) — left side, ~384 tall (author 2× ≈ 768):
| Pose slot | Meaning | Frames | Loop |
|---|---|---|---|
| `idle` | gentle sway to tempo | 4–8 | yes |
| `cheer` | raise baton / cue clap (fires on `leaderClap`) | 3–6 | one-shot |
| `hey` | (reuse of cue is fine) | 3–6 | one-shot |

**Actor `tapclap-player`** (atlas) — right side, ~384 tall:
| Pose slot | Meaning | Frames | Loop |
|---|---|---|---|
| `idle` | hands ready | 4–8 | yes |
| `hey` | clap (fires on perfect/good/barely) | 3–6 | one-shot |
| `cheer` | (reuse) | 3–6 | one-shot |

Objects: none (tap has no travelling object). Uses shared popups + HUD.

### 6.2 Fill-Bot — "Krug füllen" (hold to fill, release when full)
Mechanic: hold to grow a fill meter toward a target span, release on time.
Theme: a **Bierzelt bartender (Wirt)**; the meter is a **filling beer stein**.

**Actor `fill-bot`** (atlas) — upper, ~282 tall:
| Pose slot | Meaning | Frames | Loop |
|---|---|---|---|
| `idle` | wiping a glass | 4–8 | yes |
| `cheer` | approving nod / stein raise (fires on `fillCue` + good outcomes) | 3–6 | one-shot |
| `hey` | (reuse) | 3–6 | one-shot |

**Actor `fill-player`** (atlas) — lower, ~307 tall:
| Pose slot | Meaning | Frames | Loop |
|---|---|---|---|
| `idle` | waiting | 4–8 | yes |
| `hey` | pouring / straining (fires while holding) | 3–6 | one-shot |
| `cheer` | (reuse) | 3–6 | one-shot |

**Fill meter (replaces two rectangles at 360,1050, 504 × 51):**
| Key | Purpose | Render size | Type |
|---|---|---|---|
| `fill-stein-empty` | Meter frame / empty stein | 504 × 51 (or a taller stein re-anchored) | image |
| `fill-stein-fill` | The beer + foam fill, scaled left→right by fill fraction | 504 × 51 | image |

> The fill bar is anchored left and scaled by `fillFraction` via `setDisplaySize`.
> A horizontal "beer level" bar maps cleanly to the existing 504×51 slot. If you
> want a **vertical** stein instead, that needs the controller changed to scale
> on Y and re-anchor bottom.

### 6.3 Release-Cue — "Spann & Los!" (hold to charge, release on beat)
Mechanic: hold to build charge, release exactly on the beat.
Theme: a **Schießbude slingshot** — a **gallery operator** cues; the player
draws a **slingshot** and looses on the beat. Charge bar = draw tension; release
marker = the on-beat target line.

**Actor `release-coach`** (atlas) — upper, ~282 tall:
| Pose slot | Meaning | Frames | Loop |
|---|---|---|---|
| `idle` | leaning on the counter | 4–8 | yes |
| `cheer` | "now!" call, points to target (fires on `chargeCue`) | 3–6 | one-shot |
| `hey` | (reuse) | 3–6 | one-shot |

**Actor `release-player`** (atlas) — lower, ~307 tall:
| Pose slot | Meaning | Frames | Loop |
|---|---|---|---|
| `idle` | slingshot at rest | 4–8 | yes |
| `hey` | draw / release (fires while holding + on release) | 3–6 | one-shot |
| `cheer` | (reuse) | 3–6 | one-shot |

**Charge meter (replaces rectangles + marker at 360,1050):**
| Key | Purpose | Render size | Type |
|---|---|---|---|
| `charge-track-empty` | Meter frame (draw-tension track) | 504 × 51 | image |
| `charge-track-fill` | Charge fill, scaled left→right by charge fraction | 504 × 51 | image |
| `charge-release-marker` | The on-beat release line, pulses on cue | ~12 × 82 | image |

### 6.4 Flick-Rally — "Wurf-Rallye" (flick up on the beat)
Mechanic: a served object travels toward the player; a flick **up** returns it.
Theme: a **Wurfbude** — a **stall operator** serves; the player flicks a **ball**
back up at a target. Only `up` is used (`flickDirections: ["up"]`).

**Actor `flick-server`** (atlas) — top, ~256 tall:
| Pose slot | Meaning | Frames | Loop |
|---|---|---|---|
| `idle` | ready | 4–8 | yes |
| `cheer` | serve/toss (fires on `serveCue`) | 3–6 | one-shot |
| `hey` | (reuse) | 3–6 | one-shot |

**Actor `flick-player`** (atlas) — bottom, ~282 tall:
| Pose slot | Meaning | Frames | Loop |
|---|---|---|---|
| `idle` | ready | 4–8 | yes |
| `hey` | flick / swat upward (fires on successful flick) | 3–6 | one-shot |
| `cheer` | (reuse) | 3–6 | one-shot |

**Throwable (replaces the yellow square, ~43 px, travels 360,461 ↔ 360,819):**
| Key | Purpose | Render size | Type |
|---|---|---|---|
| `flick-ball` | The served/returned object | ~48 × 48 (2× = 96) | image (or small atlas if you want a spin animation) |

> Optional polish: a `flick-target` prop at the top the ball is launched toward,
> and a small impact `flick-splash` — both optional, not required by current code.

---

## 7. Retained audio (no work — listed for traceability)

The minigame definitions reference these song ids; their instrumental tracks are
kept from the existing FNF audio set.

| Minigame | `song.id` | BPM |
|---|---|---|
| tap-clap | `tutorial` | 100 |
| fill-bot | `fresh` | 120 |
| release-cue | `bopeebo` | 100 |
| flick-rally | `blammed` | 165 |

*(If you later want original Volksfest music, that's a separate audio task —
Blaskapelle / oompah tracks at these BPMs would fit the theme.)*

---

## 8. Master asset checklist

### Actor atlases (PNG + XML pairs) — 8 total
- [ ] `tapclap-leader` (idle, cheer, hey)
- [ ] `tapclap-player` (idle, cheer, hey)
- [ ] `fill-bot` (idle, cheer, hey)
- [ ] `fill-player` (idle, cheer, hey)
- [ ] `release-coach` (idle, cheer, hey)
- [ ] `release-player` (idle, cheer, hey)
- [ ] `flick-server` (idle, cheer, hey)
- [ ] `flick-player` (idle, cheer, hey)

### Interactive objects — 6 images
- [ ] `fill-stein-empty`, `fill-stein-fill`
- [ ] `charge-track-empty`, `charge-track-fill`, `charge-release-marker`
- [ ] `flick-ball`

### Shared UI — popups (4) + HUD (1 required, 2 optional)
- [ ] `popup-perfect`, `popup-good`, `popup-barely`, `popup-miss`
- [ ] `hud-beat-pulse` (required — replaces primitive)
- [ ] `hud-instruction-panel`, `hud-cue-burst` (optional)

### Backgrounds — 4 (or 1 shared)
- [ ] `bg-tapclap`, `bg-fillbot`, `bg-release`, `bg-flick`

### Select screen — 6 (all optional but recommended)
- [ ] `select-bg`, `icon-tapclap`, `icon-fillbot`, `icon-release`, `icon-flick`, `ui-back-arrow`

**Totals:** 8 actor atlases (16 files), 6 object images, 4 popups, 1–3 HUD, 1–4
backgrounds, 0–6 select. **Minimum viable ≈ 23 art pieces; fully polished ≈ 35.**

---

## 9. Code touch-points when swapping in these assets

Generating the art is step one; wiring it in touches these files:

1. **Definition JSON** (`assets/data/rhythm/minigames/*.json`) — replace the
   `assets[]` entries (atlas/image paths + keys) with the new Volksfest keys/paths.
2. **`RhythmCharacterAnimations.js`** — update `POSE_FRAME_PREFIXES` to map each
   new atlas key → its frame-name prefixes (`idle`/`cheer`/`hey`).
3. **Controllers** (`TapClapGame`, `FillBotGame`, `ReleaseGame`, `FlickRallyGame`)
   — update the `*_ASSETS` maps (atlas keys + popup keys), and for meters/ball
   swap `_addRect`/`_addCircle` calls for `_addImage`/`_addSprite`.
4. **`RhythmMinigame.js`** — if converting the beat indicator to art, swap
   `_addCircle` in `_createBeatIndicator()` for an image.
5. **`MinigameSelectState.js`** — optional icon/background wiring.

**Pose vocabulary note:** staying within `idle`/`cheer`/`hey` needs **no** code
change to the pose set. Adding a genuinely distinct 4th pose (e.g. a separate
"hold" vs "release" animation for the player) requires extending `RHYTHM_POSES`
and every `POSE_FRAME_PREFIXES` entry.

---

## 10. Suggested generation priority

1. **Judgement popups (4)** + **beat pulse (1)** — shared by all four, biggest
   legibility win per asset.
2. **Interactive objects (6)** — the ball and meters are the elements that
   currently read as meaningless rectangles; these most directly fix "I can't
   tell how to play."
3. **Actor atlases (8)** — largest effort; do one minigame end-to-end first
   (recommend Fill-Bot: the stein fill is the clearest theme-to-mechanic match)
   to validate the pipeline before producing the rest.
4. **Backgrounds (1–4)** and **select-screen polish (6)** — last.

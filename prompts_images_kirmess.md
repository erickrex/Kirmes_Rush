# Kirmes / Volksfest — ChatGPT Image Prompts

Copy-paste image-generation prompts for **every asset** listed in
`assets_volksfest_rythm.md`, written for ChatGPT's image generator
(GPT-4o / `gpt-image-1`).

> **Numbering:** every generatable image has an id like `2_1`, `6_12` (section _
> item). Use it as the working filename while generating, then rename to the
> asset key (in backticks) when you wire it in.

---

## 0. How to use this document

1. **Always prepend the [Master Style Block](#1-master-style-block)** to each
   asset prompt below. Each per-asset entry only contains the *subject-specific*
   part; the style block keeps all assets visually consistent.
2. **Generate a style anchor first.** Produce `bg-fillbot` (or any one actor),
   confirm the look, then in the *same chat* say "keep this exact art style,
   palette, and line weight" before each new asset. Same-conversation context is
   the most reliable way to hold a consistent style in ChatGPT.
3. **Ask for the right output size.** Each entry lists a recommended generation
   size. ChatGPT supports `1024×1024` (square), `1024×1536` (portrait), and
   `1536×1024` (landscape). Downscale/crop to the spec's render size afterward.
4. **Request transparency explicitly** for everything except full-bleed
   backgrounds — the style block already does this, but keep the phrase
   "on a fully transparent background" if you trim a prompt.

### What ChatGPT CANNOT do here (do these steps manually)
- **It cannot output the Sparrow `.xml` atlas.** Generate the individual frames
  as transparent PNGs, then pack them into a Sparrow/Starling atlas with
  TexturePacker (export format "Sparrow") to produce the `.png` + `.xml` pair the
  loader needs. Name frames `<prefix>0000`, `<prefix>0001`, … per the spec.
- **It cannot guarantee frame-perfect animation.** Multi-frame consistency across
  a generated set is unreliable. Two realistic options:
  - *MVP:* generate ONE clean pose per slot and ship it as a single-frame
    "animation" (the framework plays a 1-frame clip fine).
  - *Polished:* generate one master pose, then use it as an uploaded reference
    and ask for small pose deltas — expect manual cleanup in an editor.
- **It cannot make ultra-wide bars** (e.g. 504×51 ≈ 10:1) at native ratio.
  Generate the meter art wider/taller on a `1536×1024` canvas and crop to the
  bar, or author those two meter fills by hand from the generated stein/track.

---

## 1. Master Style Block

> **Prepend this to every prompt below.**

```
STYLE: Modern mobile rhythm-game illustration for a German "Volksfest / Kirmes"
(funfair) theme. Friendly painterly cartoon vector look, clean readable
silhouettes, soft cel shading, gentle rim light, subtle grain. Warm festive
evening mood with string-light glow. Color palette: Bavarian blue #2E5AAC and
white #F7F7F2, festive red #D6403A, warm gold #F2B33D, gingerbread brown
#8A4B2A, cream #FCEBC7, with soft dark-plum shadows. High contrast so shapes
read at small size on a phone screen. No photorealism, no gore, no text unless
explicitly requested, no logos or brand marks, no watermark. Family-friendly.
Rendered on a fully transparent background (unless it is a full-screen
background). Single centered subject, generous even margins, no cropping of the
subject.
```

---

## 2. Backgrounds  (§5.1)

Full-bleed portrait scene backdrops. **Generate at `1024×1536`** (portrait),
upscale/crop to 720×1280. Keep the vertical middle band calm (actors/meters sit
there). These are the ONE category that should be opaque, full-frame (no
transparency).

### 2_1 · `bg-tapclap`
```
A portrait full-screen background of a cozy German funfair bandstand at dusk: a
striped festival tent stage with brass-band music stands, colorful bunting and
garlands, warm glowing string lights overhead. Empty center stage area kept
visually calm and uncluttered so game characters can stand on it. No people, no
text. Opaque full-frame illustration.
```

### 2_2 · `bg-fillbot`
```
A portrait full-screen background inside a German beer tent (Bierzelt): long wooden
benches, a polished bar counter with beer taps, hanging pretzels and warm lantern
light, blue-and-white diamond banners. The central vertical strip is kept simple
and open for game elements. No people, no text. Opaque full-frame illustration.
```

### 2_3 · `bg-release`
```
A portrait full-screen background of a funfair shooting-gallery stall
(Schießbude): a colorful wooden booth with a striped awning, rows of little
targets and tin stars in the background, festive light bulbs framing the stall.
Central area kept calm for gameplay. No people, no text. Opaque full-frame
illustration.
```

### 2_4 · `bg-flick`
```
A portrait full-screen background of a funfair throwing stall (Wurfbude): a
booth with a back wall of stacked cans and hanging plush prizes, striped awning,
warm string lights, wooden counter. Central vertical strip kept open for game
elements. No people, no text. Opaque full-frame illustration.
```

### 2_5 · `bg-volksfest` (optional shared fallback)
```
A portrait full-screen background of a generic German funfair midway at dusk:
silhouetted Ferris wheel and tents, bunting, warm string lights, festive glow.
Calm open center band for gameplay. No people, no text. Opaque full-frame
illustration.
```

---

## 3. Judgement popups  (§5.2)

Transparent, bold, readable at a glance. **Generate at `1536×1024`** (wide),
crop to ~720×320. These DO contain text — spell it exactly and request a clean,
legible festive display lettering.

### 3_1 · `popup-perfect`
```
A bold festive word-badge reading exactly "PERFEKT!" in chunky rounded display
lettering, gold #F2B33D fill with white outline and a soft red drop shadow,
small sparkles and a tiny pretzel or star flourish. Transparent background.
```

### 3_2 · `popup-good`
```
A bold festive word-badge reading exactly "GUT!" in chunky rounded display
lettering, Bavarian blue #2E5AAC fill with white outline and soft shadow, small
cheerful flourish. Transparent background.
```

### 3_3 · `popup-barely`
```
A festive word-badge reading exactly "OKAY" in chunky rounded display lettering,
warm cream #FCEBC7 fill with brown #8A4B2A outline, neutral calm styling.
Transparent background.
```

### 3_4 · `popup-miss`
```
A festive word-badge reading exactly "DANEBEN" in chunky rounded display
lettering, muted grey-blue fill with a slightly droopy, deflated feel and a small
puff-of-dust flourish, still friendly not harsh. Transparent background.
```

---

## 4. HUD chrome  (§5.3)

### 4_1 · `hud-beat-pulse`  (required — replaces the yellow circle)
**Generate `1024×1024`**, crop tight. Round element that reads at ~32 px.
```
A single round festival light bulb / carnival lantern icon, warm glowing gold
with a white-hot center and a thin brass rim, gently radiant. Simple, symmetrical,
centered, readable when tiny. Transparent background.
```

### 4_2 · `hud-instruction-panel`  (optional)
**Generate `1536×1024`**, crop to ~660×90 banner.
```
A horizontal festive banner plate / ribbon sign, blank in the middle for text to
be overlaid later, wooden-and-gold funfair signage with small bunting corners,
soft shadow. No text. Transparent background, 9-slice friendly (simple flat
center, decorative ends).
```

### 4_3 · `hud-cue-burst`  (optional)
**Generate `1024×1024`.**
```
A radiant starburst / firework flourish in gold and red, semi-transparent glow
rays emanating from center, meant to sit behind a short call-to-action word. No
text. Transparent background.
```

---

## 5. Minigame Select screen  (§5.4)

### 5_1 · `select-bg`
**Generate `1024×1536`**, opaque full-frame.
```
A portrait full-screen menu background of a German funfair midway at dusk with a
Ferris wheel, tents and warm string lights, slightly darkened and blurred so
bright menu text and icons pop on top. Calm, uncluttered. No text. Opaque.
```

### Select icons
**Generate each `1024×1024`**, transparent, crop to ~120×120. Same rounded-badge
container for a consistent set.

#### 5_2 · `icon-tapclap`
```
A small round funfair menu icon: two clapping cartoon hands with tiny motion
sparkles, on a rounded gold-rimmed blue badge. Simple, bold, readable at 120 px.
Transparent background.
```
#### 5_3 · `icon-fillbot`
```
A small round funfair menu icon: a frothy German beer stein filling up, on a
rounded gold-rimmed blue badge. Simple, bold, readable at 120 px. Transparent
background.
```
#### 5_4 · `icon-release`
```
A small round funfair menu icon: a drawn-back slingshot aimed upward, on a
rounded gold-rimmed blue badge. Simple, bold, readable at 120 px. Transparent
background.
```
#### 5_5 · `icon-flick`
```
A small round funfair menu icon: a ball arcing upward with a flick motion trail,
on a rounded gold-rimmed blue badge. Simple, bold, readable at 120 px.
Transparent background.
```

### 5_6 · `ui-back-arrow`
**Generate `1024×1024`**, transparent, crop to ~48×48.
```
A simple left-pointing back arrow glyph in warm gold with a white outline,
rounded friendly funfair styling, centered. Transparent background.
```

---

## 6. Actor characters  (§6)

Every prompt below is self-contained — copy-paste any single one on its own. All
actors: generate at **portrait `1024×1536`**, transparent, full body. (Workflow
and atlas-packing steps are in §0 and §9, not here.)

### 6.1 Tap-Clap actors

#### 6_1 · `tapclap-leader` / `idle` (canonical design)
```
Full-body cartoon German funfair BANDLEADER / Kapellmeister mascot, cheerful and
round, wearing a Bavarian jacket with gold buttons, a small feathered Tyrolean
hat, holding a conductor's baton. Front-facing, relaxed idle stance, friendly
smile. Full body visible with margin. Transparent background.
```
#### 6_2 · `tapclap-leader` / `cheer` (fires on `leaderClap` — cue the clap)
```
Full-body cartoon German funfair BANDLEADER / Kapellmeister mascot, cheerful and
round, wearing a Bavarian jacket with gold buttons and a small feathered Tyrolean
hat, holding a conductor's baton: raising the baton high with an encouraging
"here comes the beat!" gesture, big open smile. Front-facing, full body visible
with margin. Transparent background.
```
#### 6_3 · `tapclap-leader` / `hey` (reuse of cue is fine)
```
Full-body cartoon German funfair BANDLEADER / Kapellmeister mascot, cheerful and
round, wearing a Bavarian jacket with gold buttons and a small feathered Tyrolean
hat, holding a conductor's baton: a sharp downward baton beat "now!" pose.
Front-facing, full body visible with margin. Transparent background.
```

**`tapclap-player`** — the clapping spectator (right side, ~384 tall).

#### 6_4 · `tapclap-player` / `idle`
```
Full-body cartoon German funfair SPECTATOR mascot in festive folk clothing,
front-facing relaxed idle stance, hands ready near chest, happy anticipating
expression. Full body visible with margin. Transparent background.
```
#### 6_5 · `tapclap-player` / `hey` (fires on a good tap — the clap)
```
Full-body cartoon German funfair SPECTATOR mascot in festive folk clothing:
mid-clap with both hands together and small impact sparkles, joyful expression.
Front-facing, full body visible with margin. Transparent background.
```
#### 6_6 · `tapclap-player` / `cheer` (reuse)
```
Full-body cartoon German funfair SPECTATOR mascot in festive folk clothing: both
arms raised in a big cheer, joyful expression. Front-facing, full body visible
with margin. Transparent background.
```

### 6.2 Fill-Bot actors

**`fill-bot`** — the beer-tent bartender (upper, ~282 tall).

#### 6_7 · `fill-bot` / `idle`
```
Full-body cartoon German BEER-TENT BARTENDER (Wirt) mascot, sturdy and jolly,
apron over a checked shirt, rolled sleeves, front-facing idle stance calmly
wiping a glass, warm smile. Full body visible with margin. Transparent background.
```
#### 6_8 · `fill-bot` / `cheer` (fires on `fillCue` and good outcomes)
```
Full-body cartoon German BEER-TENT BARTENDER (Wirt) mascot, sturdy and jolly,
apron over a checked shirt, rolled sleeves: proudly hoisting a full frothy beer
stein overhead with an approving grin. Front-facing, full body visible with
margin. Transparent background.
```
#### 6_9 · `fill-bot` / `hey` (reuse)
```
Full-body cartoon German BEER-TENT BARTENDER (Wirt) mascot, sturdy and jolly,
apron over a checked shirt, rolled sleeves: a big thumbs-up "prost!" pose.
Front-facing, full body visible with margin. Transparent background.
```

**`fill-player`** — the one filling (lower, ~307 tall).

#### 6_10 · `fill-player` / `idle`
```
Full-body cartoon funfair PATRON mascot in festive folk clothing, front-facing
relaxed idle stance, waiting eagerly. Full body visible with margin. Transparent
background.
```
#### 6_11 · `fill-player` / `hey` (fires while holding — pouring/straining to fill)
```
Full-body cartoon German funfair PATRON mascot in festive folk clothing: leaning
in and pulling a beer tap handle with focused effort, cheeks puffed. Front-facing,
full body visible with margin. Transparent background.
```
#### 6_12 · `fill-player` / `cheer` (reuse)
```
Full-body cartoon German funfair PATRON mascot in festive folk clothing:
celebrating with both fists up. Front-facing, full body visible with margin.
Transparent background.
```

### 6.3 Release-Cue actors

**`release-coach`** — the shooting-gallery operator (upper, ~282 tall).

#### 6_13 · `release-coach` / `idle`
```
Full-body cartoon funfair SHOOTING-GALLERY OPERATOR mascot, a friendly carnival
barker in a striped vest and straw boater hat, front-facing idle stance leaning
casually on a counter, sly encouraging smile. Full body visible with margin.
Transparent background.
```
#### 6_14 · `release-coach` / `cheer` (fires on `chargeCue` — "now!")
```
Full-body cartoon German funfair SHOOTING-GALLERY OPERATOR mascot, a friendly
carnival barker in a striped vest and straw boater hat: pointing sharply upward
at a target with a "release now!" call, excited expression. Front-facing, full
body visible with margin. Transparent background.
```
#### 6_15 · `release-coach` / `hey` (reuse)
```
Full-body cartoon German funfair SHOOTING-GALLERY OPERATOR mascot, a friendly
carnival barker in a striped vest and straw boater hat: a triumphant fist-pump.
Front-facing, full body visible with margin. Transparent background.
```

**`release-player`** — the one with the slingshot (lower, ~307 tall).

#### 6_16 · `release-player` / `idle`
```
Full-body cartoon funfair CHALLENGER mascot in festive folk clothing holding a
wooden Y-shaped slingshot at rest, front-facing relaxed idle stance, determined
smile. Full body visible with margin. Transparent background.
```
#### 6_17 · `release-player` / `hey` (fires while holding and on release — draw/release)
```
Full-body cartoon German funfair CHALLENGER mascot in festive folk clothing
holding a wooden Y-shaped slingshot: drawing the slingshot band back taut, one
eye squinted, aiming upward with tension. Front-facing, full body visible with
margin. Transparent background.
```
#### 6_18 · `release-player` / `cheer` (reuse)
```
Full-body cartoon German funfair CHALLENGER mascot in festive folk clothing
holding a wooden Y-shaped slingshot: arms up celebrating a hit. Front-facing,
full body visible with margin. Transparent background.
```

### 6.4 Flick-Rally actors

**`flick-server`** — the throwing-stall operator (top, ~256 tall).

#### 6_19 · `flick-server` / `idle`
```
Full-body cartoon funfair THROWING-STALL OPERATOR mascot in a striped apron,
front-facing idle stance holding a ball ready, cheeky grin. Full body visible
with margin. Transparent background.
```
#### 6_20 · `flick-server` / `cheer` (fires on `serveCue` — the toss)
```
Full-body cartoon German funfair THROWING-STALL OPERATOR mascot in a striped
apron: mid-underhand-toss releasing a ball toward the viewer, dynamic
follow-through. Front-facing, full body visible with margin. Transparent
background.
```
#### 6_21 · `flick-server` / `hey` (reuse)
```
Full-body cartoon German funfair THROWING-STALL OPERATOR mascot in a striped
apron: pointing forward with a "your turn!" gesture. Front-facing, full body
visible with margin. Transparent background.
```

**`flick-player`** — the one flicking it back (bottom, ~282 tall).

#### 6_22 · `flick-player` / `idle`
```
Full-body cartoon funfair PLAYER mascot in festive folk clothing, front-facing
ready stance with hands raised to react, focused expression. Full body visible
with margin. Transparent background.
```
#### 6_23 · `flick-player` / `hey` (fires on a successful flick — swat upward)
```
Full-body cartoon German funfair PLAYER mascot in festive folk clothing: a strong
upward flicking / swatting motion with one arm, motion sparkles, energetic
expression. Front-facing, full body visible with margin. Transparent background.
```
#### 6_24 · `flick-player` / `cheer` (reuse)
```
Full-body cartoon German funfair PLAYER mascot in festive folk clothing: jumping
with joy, both arms up. Front-facing, full body visible with margin. Transparent
background.
```

---

## 7. Interactive objects  (§6 objects)

All transparent. Generate `1024×1024` unless noted; crop tight.

### 7_1 · `flick-ball`  (~48×48 target)
```
A single small funfair throwing ball, glossy red-and-white with a gold stripe,
soft cartoon shading and a subtle highlight, perfectly centered and symmetrical,
readable at tiny size. Transparent background.
```

### 7_2 · `fill-stein-empty`  (meter frame, wide — generate `1536×1024`, crop to bar)
```
An empty glass beer-stein meter shown as a horizontal gauge: a clear/empty
glass vessel outline with gold-rimmed ends, left-to-right fill track, no beer
inside yet. Clean flat interior so a fill layer can sit on top. Horizontal
orientation. Transparent background. No text.
```

### 7_3 · `fill-stein-fill`  (the beer fill layer, wide — generate `1536×1024`, crop)
```
A horizontal bar of golden frothy beer with a white foam cap along the top edge,
matching the interior shape of a beer-stein gauge, meant to be revealed
left-to-right as a fill. Solid left edge. Horizontal orientation. Transparent
background. No text.
```

### 7_4 · `charge-track-empty`  (wide — generate `1536×1024`, crop to bar)
```
An empty horizontal "tension" gauge track styled as a taut slingshot band rail:
a slim wooden-and-brass channel with subtle notches, empty interior. Horizontal
orientation. Transparent background. No text.
```

### 7_5 · `charge-track-fill`  (wide — generate `1536×1024`, crop)
```
A horizontal glowing charge fill styled as stretching slingshot rubber under
tension, warm gold-to-red gradient with an energetic glow, solid left edge, meant
to grow left-to-right. Horizontal orientation. Transparent background. No text.
```

### 7_6 · `charge-release-marker`  (~12×82 target — generate `1024×1024`, crop tall)
```
A slim tall vertical marker line styled as a glowing target notch / bell striker
line, bright white-gold with a small star at the top, meant to mark the exact
release moment. Vertical, centered. Transparent background. No text.
```

### Optional polish
#### 7_7 · `flick-target`
```
A funfair target prop: a stack of tin cans or a ringable bell mounted on a small
post, colorful and readable, centered. Transparent background.
```
#### 7_8 · `flick-splash`
```
A small cartoon impact burst / dust puff with a few sparkles, warm gold and
white, centered, for a hit effect. Transparent background.
```

---

## 8. Prompt-to-asset coverage checklist

Mirrors the master checklist in `assets_volksfest_rythm.md`. IDs in brackets.

- [ ] Backgrounds: `bg-tapclap` [2_1], `bg-fillbot` [2_2], `bg-release` [2_3], `bg-flick` [2_4] (+ optional `bg-volksfest` [2_5])
- [ ] Popups: `popup-perfect` [3_1], `popup-good` [3_2], `popup-barely` [3_3], `popup-miss` [3_4]
- [ ] HUD: `hud-beat-pulse` [4_1] (+ optional `hud-instruction-panel` [4_2], `hud-cue-burst` [4_3])
- [ ] Select: `select-bg` [5_1], `icon-tapclap` [5_2], `icon-fillbot` [5_3], `icon-release` [5_4], `icon-flick` [5_5], `ui-back-arrow` [5_6]
- [ ] Tap-Clap actors: `tapclap-leader` idle/cheer/hey [6_1/6_2/6_3], `tapclap-player` idle/hey/cheer [6_4/6_5/6_6]
- [ ] Fill-Bot actors: `fill-bot` idle/cheer/hey [6_7/6_8/6_9], `fill-player` idle/hey/cheer [6_10/6_11/6_12]
- [ ] Release actors: `release-coach` idle/cheer/hey [6_13/6_14/6_15], `release-player` idle/hey/cheer [6_16/6_17/6_18]
- [ ] Flick actors: `flick-server` idle/cheer/hey [6_19/6_20/6_21], `flick-player` idle/hey/cheer [6_22/6_23/6_24]
- [ ] Objects: `flick-ball` [7_1], `fill-stein-empty` [7_2], `fill-stein-fill` [7_3], `charge-track-empty` [7_4], `charge-track-fill` [7_5], `charge-release-marker` [7_6] (+ optional `flick-target` [7_7], `flick-splash` [7_8])

**Total generatable images:** 39 (`2_1`–`2_5`, `3_1`–`3_4`, `4_1`–`4_3`,
`5_1`–`5_6`, `6_1`–`6_24`, `7_1`–`7_8`).

---

## 9. Post-generation pipeline (after ChatGPT)

1. **Trim & resize** each transparent PNG to the render size in
   `assets_volksfest_rythm.md` §4 (author at 2× where noted).
2. **Pack actor poses** into Sparrow atlases (TexturePacker → "Sparrow" export),
   naming frames `<prefix>0000…`; set the prefixes in `POSE_FRAME_PREFIXES`.
3. **Place files** under `assets/volksfest.assets/` per the §2.4 layout.
4. **Wire keys/paths** into the four definition JSONs and controllers (see
   `assets_volksfest_rythm.md` §9 code touch-points).
5. **Verify**: `pnpm run lint`, `pnpm run typecheck`, `pnpm test`, then load each
   minigame and check placement against the §4 layout table.

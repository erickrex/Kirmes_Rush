# Asset Migration Guide

## Overview

Phase 8 involves migrating game assets from the original Friday Night Funkin' repository to the Phaser.js implementation. The assets are already available in the `assets/funkin.assets` submodule.

## Asset Structure

Assets are organized by week/level:
- `assets/funkin.assets/songs/` - Audio files (Inst.ogg, Voices-*.ogg)
- `assets/funkin.assets/preload/data/songs/` - Chart and metadata JSON files
- `assets/funkin.assets/shared/` - Shared graphics and UI elements
- `assets/funkin.assets/week1/` through `week7/` - Week-specific assets
- `assets/funkin.assets/weekend1/` - Weekend 1 assets
- `assets/funkin.assets/tutorial/` - Tutorial assets

## Manifest System

Asset manifests are JSON files in `fnf-phaser/assets/data/manifests/` that define:
- Week/level metadata
- Song list with difficulties
- Asset paths (charts, audio, graphics)
- Character assignments
- Stage assignments

### Example Manifest Structure

```json
{
  "id": "week1",
  "name": "Daddy Dearest",
  "songs": [
    {
      "id": "bopeebo",
      "name": "Bopeebo",
      "artist": "Kawai Sprite",
      "difficulties": ["easy", "normal", "hard"],
      "assets": {
        "chart": "path/to/chart.json",
        "metadata": "path/to/metadata.json",
        "instrumental": "path/to/Inst.ogg",
        "vocals": {
          "player": "path/to/Voices-bf.ogg",
          "opponent": "path/to/Voices-dad.ogg"
        }
      },
      "characters": {
        "player": "bf",
        "opponent": "dad",
        "girlfriend": "gf"
      },
      "stage": "stage"
    }
  ]
}
```

## Loading Assets

The game's registry system (SongRegistry, CharacterRegistry, StageRegistry) loads assets based on these manifests:

1. **BootScene** loads core UI assets
2. **LoadingState** loads level-specific assets based on manifest
3. **PlayState** uses loaded assets for gameplay

## Asset Types

### Audio Files
- **Instrumental**: `Inst.ogg` - Background music track
- **Vocals**: `Voices-{character}.ogg` - Character vocal tracks
- Format: OGG Vorbis for web compatibility

### Chart Files
- **Chart JSON**: Contains note data, events, timing
- **Metadata JSON**: Contains song info, BPM, scroll speed
- Format: FNF chart format (parsed by ChartParser)

### Graphics
- **Spritesheets**: PNG + XML (Sparrow atlas format)
- **Characters**: Animated character sprites
- **Stages**: Background layers and props
- **UI**: Menu elements, HUD components

## Migration Status

### Completed
- ✅ Task 8.1: Tutorial manifest created
- ✅ Task 8.2: Week 1 manifest created

### Remaining
- Week 2 (Spooky Month)
- Week 3 (Pico)
- Week 4 (Mommy Must Murder)
- Week 5 (Red Snow)
- Week 6 (Hating Simulator)
- Week 7 (Tankman)
- Weekend 1 (Darnell)

## Testing Assets

To test a migrated week:

1. Ensure manifest exists in `assets/data/manifests/`
2. Load the game and navigate to Story Mode or Freeplay
3. Select the week/song
4. Verify:
   - Chart loads correctly
   - Audio plays and syncs
   - Characters animate properly
   - Stage renders correctly

## Notes

- All assets are already present in the `assets/funkin.assets` submodule
- Manifests simply reference existing asset paths
- No asset conversion is needed (formats are web-compatible)
- The game's existing parsers (ChartParser, SparrowParser) handle asset loading

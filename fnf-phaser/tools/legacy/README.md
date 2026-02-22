# Legacy Tooling (Node)

These scripts replace the old Haxe-based utility scripts.

## Convert Legacy Song JSON

Converts old per-difficulty song JSON files into a single song JSON.

```bash
cd fnf-phaser
npm run tool:convert-legacy-songs -- --root ../assets/funkin.assets/preload/data/songs
```

Useful options:
- `--song <name>`: convert only one song folder.
- `--dry-run`: print planned actions without writing files.

## Create NG Zip

Creates an uncompressed zip archive from a build output folder.

```bash
cd fnf-phaser
npm run tool:zip-ng -- --input dist
```

Useful options:
- `--output <zip-file>`: set the zip file path.

## Itch / Newgrounds Profiles

Legacy batch deployment profiles were migrated to:
`tools/legacy/itch-building/`.

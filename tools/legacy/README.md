# Legacy Tooling (Node)

These scripts replace the old Haxe-based utility scripts.

## Convert Legacy Song JSON

Converts old per-difficulty song JSON files into a single song JSON.

```bash
pnpm run tool:convert-legacy-songs -- --root ../assets/rythm-foundation.assets/preload/data/songs
```

Useful options:
- `--song <name>`: convert only one song folder.
- `--dry-run`: print planned actions without writing files.

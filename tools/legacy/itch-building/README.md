# Itch/Newgrounds Build Profiles (Node)

This folder replaces the old batch scripts in:
`art/rythm.art/funScripts/itch-building/`.

## Mappings

- `build-Itch-HTML.bat` -> `itch-html.mjs`
- `build-Itch-HTML-RELEASE.bat` -> `itch-html-release.mjs`
- `build-NG-HTML-RELEASE.bat` -> `ng-html-release.mjs`
- `build-Itch-WINDOWS.bat` -> `itch-windows.mjs`
- `build-Itch-WINDOWS-CLEAN.bat` -> `itch-windows-clean.mjs`
- `build-Itch-WINDOWS-SECRET.bat` -> `itch-windows-secret.mjs`
- `build-lime-SWITCH.bat` -> `lime-switch.mjs`

## Notes

- HTML profiles are mapped to Phaser build output (`rythm-phaser/dist`).
- Windows and Switch Lime profiles are intentionally marked unsupported because they
  depended on legacy Haxe/Lime native build targets.

## Usage

```bash
cd rythm-phaser
npm run tool:itch:html:release -- --skip-upload
```

Common options:
- `--dry-run`
- `--skip-upload`

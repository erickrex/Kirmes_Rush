# Phaser 4.0.0 Cutover Notes

- Package artifact: `phaser@4.0.0`
- npm dist-tags at upgrade time:
  - `latest`: `4.0.0`
  - `beta`: `4.0.0-rc.7`
- Import pattern: runtime code now imports Phaser through `src/phaser.js`, which normalizes Phaser 4's named-export ESM shape with the suite's legacy default-export mocks.
- Low-risk tuning included in the cutover:
  - removed the unused Arcade Physics boot config from `src/main.js`
  - removed ambient-global Phaser runtime dependencies in favor of explicit module imports
- Validation after cutover:
  - `npm run typecheck`: passes
  - `npm run test:all`: passes
  - `npm run build`: passes
- Current build output:
  - `dist/assets/phaser-*.js`: 1,657.34 kB raw / 372.87 kB gzip
  - This is larger than the previous Phaser 3 baseline, so future optimization work should focus on whether Phaser 4 can be imported more selectively without breaking the current API surface.

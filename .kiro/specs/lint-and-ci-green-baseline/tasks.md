# Implementation Plan: Lint and CI Green Baseline

## Overview

Run ESLint's auto-fix to resolve all 20 formatting/curly-brace errors across 3 files, then verify the full CI pipeline passes cleanly.

## Tasks

- [x] 1. Apply ESLint auto-fix to resolve all 20 errors
  - Run `npm run lint -- --fix` from the `fnf-phaser` directory
  - This auto-fixes 16 prettier/prettier errors in `src/phaser.js` (4-space → 2-space indentation), 1 prettier/prettier error in `src/graphics/Transitions.js` (Vector2 args on single line), and 3 curly-rule errors in `src/ui/OptionsState.js` (add braces to `if` bodies)
  - _Requirements: 1.1, 1.2, 2.1, 2.2, 3.1, 3.2_

- [x] 2. Verify lint passes with zero errors
  - Run `npm run lint` from the `fnf-phaser` directory and confirm exit code 0 with zero errors and zero warnings
  - _Requirements: 4.1, 4.2, 4.3_

- [x] 3. Verify no eslint-disable comments were introduced
  - Grep the three changed files (`src/phaser.js`, `src/graphics/Transitions.js`, `src/ui/OptionsState.js`) for `eslint-disable` — expect zero matches
  - _Requirements: 7.3_

- [x] 4. Verify lint configuration files are unmodified
  - Confirm `.eslintrc` (or `eslint.config.js`) and `.prettierrc.js` have no changes (use `git diff` on those files)
  - _Requirements: 7.1, 7.2_

- [x] 5. Verify typecheck passes
  - Run `npm run typecheck` from the `fnf-phaser` directory and confirm zero type errors
  - _Requirements: 5.3_

- [x] 6. Verify all unit tests pass
  - Run `npm run test` from the `fnf-phaser` directory and confirm all 2,433 tests pass
  - _Requirements: 5.1_

- [x] 7. Verify integration tests pass
  - Run `npm run test:integration` from the `fnf-phaser` directory and confirm all 4 tests pass
  - _Requirements: 5.2_

- [x] 8. Verify build succeeds
  - Run `npm run build` from the `fnf-phaser` directory and confirm successful output with no errors
  - _Requirements: 6.2_

- [x] 9. Final checkpoint
  - Ensure all verification steps above passed. Ask the user if questions arise.
  - _Requirements: 6.1_

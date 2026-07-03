# Requirements Document

## Introduction

This spec covers fixing the remaining 20 ESLint/Prettier errors in the fnf-phaser codebase so that the CI pipeline (`npm run lint`) passes cleanly. The errors are purely cosmetic — formatting (indentation, line wrapping) and missing curly braces — and require no semantic changes to the code. Once resolved, the full CI workflow (lint, typecheck, test, test:integration, build) will pass without failures.

## Glossary

- **CI_Pipeline**: The GitHub Actions workflow defined in `.github/workflows/fnf-phaser-ci.yml` that runs lint, typecheck, test, test:integration, and build steps sequentially.
- **Lint_Runner**: The ESLint process invoked via `npm run lint` that checks source files against configured Prettier and ESLint rules.
- **Prettier_Rule**: The `prettier/prettier` ESLint rule that enforces consistent code formatting (indentation, line length, argument placement).
- **Curly_Rule**: The `curly` ESLint rule that requires curly braces on all `if`/`else`/`for`/`while` block bodies.
- **Test_Suite**: The collection of 2,433 unit tests and 4 integration tests executed by `npm run test` and `npm run test:integration`.

## Requirements

### Requirement 1: Fix Prettier Formatting in phaser.js

**User Story:** As a developer, I want `src/phaser.js` to conform to the project's 2-space indentation standard, so that the Lint_Runner reports zero prettier/prettier errors for this file.

#### Acceptance Criteria

1. WHEN the Lint_Runner processes `src/phaser.js`, THE Lint_Runner SHALL report zero prettier/prettier errors for the file.
2. THE `src/phaser.js` file SHALL use 2-space indentation throughout, matching the project formatting standard.
3. WHEN the formatting changes are applied, THE `src/phaser.js` file SHALL preserve identical runtime behavior (same exports, same Proxy logic, same property resolution order).

### Requirement 2: Fix Prettier Formatting in Transitions.js

**User Story:** As a developer, I want `src/graphics/Transitions.js` to have its `Vector2` constructor arguments on a single line where they fit, so that the Lint_Runner reports zero prettier/prettier errors for this file.

#### Acceptance Criteria

1. WHEN the Lint_Runner processes `src/graphics/Transitions.js`, THE Lint_Runner SHALL report zero prettier/prettier errors for the file.
2. THE `new Phaser.Math.Vector2()` call near line 509 SHALL have its arguments formatted on a single line as required by the Prettier_Rule.
3. WHEN the formatting change is applied, THE `src/graphics/Transitions.js` file SHALL preserve identical runtime behavior (same star-path geometry calculations).

### Requirement 3: Fix Curly Brace Violations in OptionsState.js

**User Story:** As a developer, I want all `if` statements in `src/ui/OptionsState.js` to use curly braces, so that the Lint_Runner reports zero curly-rule errors for this file.

#### Acceptance Criteria

1. WHEN the Lint_Runner processes `src/ui/OptionsState.js`, THE Lint_Runner SHALL report zero curly-rule errors for the file.
2. THE three `if` statements (at lines 806, 812, and 813) SHALL be wrapped with curly braces around their single-line bodies.
3. WHEN the curly braces are added, THE `src/ui/OptionsState.js` file SHALL preserve identical runtime behavior (same volume calculation logic, same conditional branching).

### Requirement 4: Zero Lint Errors Across Entire Codebase

**User Story:** As a developer, I want `npm run lint` to exit with code 0 and report zero errors and zero warnings, so that the CI_Pipeline lint step passes.

#### Acceptance Criteria

1. WHEN `npm run lint` is executed in the `fnf-phaser` directory, THE Lint_Runner SHALL exit with code 0.
2. WHEN `npm run lint` is executed, THE Lint_Runner SHALL report zero errors across all source files.
3. WHEN `npm run lint` is executed, THE Lint_Runner SHALL report zero warnings across all source files.

### Requirement 5: All Existing Tests Continue to Pass

**User Story:** As a developer, I want all 2,433 unit tests and 4 integration tests to continue passing after the formatting fixes, so that I have confidence no semantic behavior was altered.

#### Acceptance Criteria

1. WHEN `npm run test` is executed after the fixes, THE Test_Suite SHALL report all 2,433 unit tests passing.
2. WHEN `npm run test:integration` is executed after the fixes, THE Test_Suite SHALL report all 4 integration tests passing.
3. WHEN `npm run typecheck` is executed after the fixes, THE TypeScript compiler SHALL report zero type errors.

### Requirement 6: CI Pipeline Passes End-to-End

**User Story:** As a developer, I want the full CI_Pipeline to pass, so that pull requests are not blocked by lint failures.

#### Acceptance Criteria

1. WHEN the CI_Pipeline executes all steps (lint, typecheck, test, test:integration, build), THE CI_Pipeline SHALL complete with all steps passing.
2. THE `npm run build` step SHALL produce a successful build output with no errors.

### Requirement 7: No Lint Configuration Changes

**User Story:** As a developer, I want the lint fixes to be achieved purely through code formatting changes, so that the project's code quality standards remain unchanged.

#### Acceptance Criteria

1. THE `.eslintrc` configuration file SHALL remain unmodified after the fixes are applied.
2. THE `.prettierrc.js` configuration file SHALL remain unmodified after the fixes are applied.
3. THE fixes SHALL NOT introduce any `eslint-disable` comments, inline rule overrides, or file-level ignore directives.

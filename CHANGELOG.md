## [1.0.7] - 2026-08-26

### Changed
- `scanA11y`/`checkAccessibility` now records a separate soft assertion per accessibility violation (id, impact, help text, and affected element count) instead of a single assertion on the total violation count, so each issue is individually visible in the test report.
- Wrapped `VisualReporter.highlightElement` in a `test.step` for clearer step-by-step traceability in Playwright reports.

## [1.0.6] - 2026-08-25

### Fixed
- `SnapAllyReporter` no longer warns "A11y attachment missing" for tests that never call `scanA11y`/`checkAccessibility`. The warning now only fires when a test actually attempted a scan (tracked via an internal annotation) but the `'A11y'` attachment still didn't show up.

## [1.0.5] - 2026-08-18

### Changed
- Added a distinct "Not Tested" state (global and per-browser) shown when every test in a group was skipped, instead of incorrectly reporting "Compliant".
- Fixed the "Not Tested" card's background gradient to meet WCAG AA contrast for its description text.

## [1.0.4] - 2026-08-18

### Changed
- Fixed skipped tests creating a separate "N/a" browser tab in the summary report; they now group under their actual browser/project.
- Added a "Skipped" badge in the Test Suite Details list so skipped tests stay visually distinguishable.

## [1.0.3] - 2026-06-14 [*](https://github.com/apis3445/snap-ally/pull/22)

### Changed
- Improved accessibility reporting by aggregating results across multiple scans within a single test.
- Enhanced report UI to render exception output with preserved formatting.

## [1.0.2] - 2026-06-14 [*](https://github.com/apis3445/snap-ally/pull/21)

### Changed
- Updated Playwright dependencies to 1.60.
- Improved accessibility scan/report generation robustness and overlay rendering.

## [1.0.1] - 2026-03-28 [*](https://github.com/apis3445/snap-ally/pull/20)

### Changed
- Updated the README demo video link.
- Bumped package version to 1.0.1.

## [1.0.0] - 2026-03-21

### Changed
- Improved Azure DevOps bug creation by supporting configurable area paths and more robust attachment handling.
- Expanded Playwright test coverage by adding additional desktop browser projects.
- Added global `verbose` and `consoleLog` configuration options to the reporter.
- Re-branded `checkAccessibility` as the primary function in documentation.
- Improved report step titles to avoid "failed with 0" messages.
- Updated default color palette to high-contrast versions for better accessibility.
- Optimized violation distribution chart height and bar thickness for fewer items.
- Removed internal debug logs from the terminal output.

## 2026-03-14

### Changed
- Adjusted Playwright imports to prevent duplicate module loading during test/config evaluation.

## 2026-03-13

### Changed
- Fixed the option to create bugs on Azure DevOps and include the steps
- Updated A11yHtmlRenderer to generate unique data filenames for reports to prevent collisions.
- Modified A11yScanner to simplify overlay initialization by removing unnecessary pageKey parameter.

## 2026-03-07

### Changed
- Refined report UI structure and styling for improved readability and consistency.
- Added ESLint/Prettier tooling and updated package metadata for the next beta release.

## 2026-03-05

### Changed
- Removed the EJS dependency by switching report templates to static HTML with client-side data injection and shared styling/scripts.  
- Improved report generation and attachment handling for videos/screenshots, and captured richer metadata (e.g., page URL, timestamps, and steps).
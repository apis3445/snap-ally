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
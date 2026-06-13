# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

snap-ally is an npm package: a custom Playwright reporter for accessibility testing with Axe-core. It generates HTML reports with visual evidence (screenshots with violation overlays, video) and Azure DevOps deep links for bug creation.

## Commands

```bash
npm run build        # tsc + copy src/templates/* to dist/templates (templates are required at runtime)
npm test             # npx playwright test --project=chromium
npm run lint         # eslint .
npm run lint:fix
npm run format       # prettier
```

Run a single test / all browsers:

```bash
npx playwright test tests/local-test.spec.ts --project=chromium
npx playwright test                  # all 3 projects: chromium, desktop-firefox, desktop-webkit
```

**Important:** `playwright.config.ts` registers only the `html` reporter and the custom SnapAllyReporter — neither prints pass/fail results to the terminal, so a test run looks silent. Add `--reporter=list` to see results in the console:

```bash
npx playwright test --reporter=list
```

The config loads the reporter from TS source (`./src/SnapAllyReporter.ts`) and `tests/local-test.spec.ts` imports `scanA11y` from `../src`. The local test scans a live external site and is expected to fail when that page has real violations (soft assertion `expect.soft(violationCount).toBe(0)` in `src/core/Scanner.ts`).

## Architecture

The package has two halves that run in different processes and communicate through Playwright **test attachments**:

1. **Test-side scan** — `scanA11y` / `checkAccessibility` (`src/core/Scanner.ts`), called inside a test with `(page, testInfo, options)`:
   - Runs AxeBuilder with optional `include`, `rules`, `tags`, `axeOptions`.
   - Resolves options as local > reporter config > defaults. It finds the reporter config by matching entries in `testInfo.config.reporter` against `/snap-?ally/i` (covers both the in-repo file path and the published package name `snap-ally`) — **renaming the reporter file or package breaks this lookup**.
   - For each violating element, `VisualReporter` (`src/core/VisualReporter.ts`) injects a shadow-DOM overlay (banner + highlight) into the page, captures a screenshot, then cleans up.
   - Adds a soft assertion step named `Check Accessibility`, then attaches the full `ReportData` JSON to the test as an attachment named `A11y`. This attachment is the only bridge to the reporter.

2. **Reporter-side rendering** — `SnapAllyReporter` (`src/SnapAllyReporter.ts`):
   - `onBegin` **deletes and recreates** the output folder (default `steps-report/`); `validateOutputFolder` guards against unsafe paths.
   - `onTestEnd` parses the `A11y` attachment, copies videos/screenshots/attachments via `ReportAssets` into `test-N/` folders, and renders `report.html` plus `accessibility-report.html` (when violations exist) per test.
   - `onEnd` renders `summary.html` with per-browser summaries and WCAG rule counts, de-duplicating violation counts for the same test across browsers (`testGlobalCounts` / `testRuleCounts`).

**Rendering** (`src/core/HtmlRenderer.ts`) does not use a template engine: it copies static templates from `src/templates/`, inlines `global-report-styles.css` and `report-app.js`, and injects the test data as JSON consumed client-side. Templates are resolved relative to `__dirname`, which is why the build step must copy `src/templates` into `dist/templates`.

**Models** live in `src/models/` (re-exported via `src/models/index.ts`); the public API surface is `src/index.ts` (default export `SnapAllyReporter`, plus `scanA11y`/`checkAccessibility` and helpers).

ADO settings resolve as: scan options > reporter options > env vars (`ADO_ORGANIZATION`, `ADO_PROJECT`, `ADO_AREA_PATH`).

## Build/publish notes

- `tsconfig.json` compiles only `src/` (CommonJS, ES2019) to `dist/`; `*.spec.ts` is excluded. Only `dist/` and `README.md` are published (`files` in package.json); `prepublishOnly` runs the build.
- `@playwright/test` is a peer dependency — the only runtime dependency is `@axe-core/playwright`.
- Releases run through `.github/workflows/release.yml`; CHANGELOG.md is updated automatically by CI.

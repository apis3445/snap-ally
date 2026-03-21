# snap-ally 📸♿

[![npm version](https://img.shields.io/npm/v/snap-ally.svg)](https://www.npmjs.com/package/snap-ally)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/U7U1U2V3V)

A powerful, developer-friendly Playwright reporter for **Accessibility testing** using Axe-core. Beyond just reporting, it provides visual evidence to help developers fix accessibility issues faster.

---

## 🤔 Why the name "Snap-Ally"?

- **Snap**: Like a snapshot, it provides an instant picture of a website's accessibility state at the moment the tests are executed.
- **Ally**: It resembles **a11y** (the abbreviation for accessibility) and serves as an ally that allows you to create bugs in Azure DevOps more easily.

## 💡 Motivation

I have seen closely how much people with disabilities struggle with something as fundamental as finding a job.

I believe that with relatively simple changes in HTML, good color contrast, among other things, systems should work and help all people equally. Since about 15% of the world's population lives with some form of disability.

---

## 📺 Demo

**[▶️ Watch the Demo Video](https://www.loom.com/share/853c04f1f76242a699e8f82e54733007)**

---

## ✨ Features

- **Beautiful HTML Reporting**: Comprehensive summary and detail pages.
- **Visual Overlays**: Highlights violations directly on the page in screenshots.
- **Automated Bug Preview**: Generates bug-like reports for each violation with clear technical details.
- **Azure DevOps (ADO) Integration**: Link directly to your ADO project to create/manage accessibility bugs.
- **Video & Screenshots**: Automatically captures and attaches video/screenshots of the failing state.
- **Configurable Axe Rules**: Enable/Disable specific rules or filter by WCAG tags.

---

## 🚀 Installation

```bash
npm install snap-ally --save-dev
```

---

## 🛠️ Setup

Add `snap-ally` to your `playwright.config.ts`:

```typescript
import { defineConfig } from '@playwright/test';

export default defineConfig({
    reporter: [
        [
            'snap-ally',
            {
                outputFolder: 'a11y-report',
                // Optional: Visual Customization
                colors: {
                    critical: '#b91c1c',
                    serious: '#c2410c',
                    moderate: '#a16207',
                    minor: '#1e40af',
                },
                verbose: true,      // Show in terminal
                consoleLog: true,   // Show in browser console
                // Optional: Azure DevOps Integration
                ado: {
                    organization: 'your-org',
                    project: 'your-project',
                    areaPath: 'your-project\\your-team', // Optional: Define where bugs should be created
                },
            },
        ],
    ],
});
```

---

## <span aria-hidden="true">📖</span> Usage

Import and use `checkAccessibility` within your Playwright tests:

```typescript
import { test } from '@playwright/test';
import { checkAccessibility } from 'snap-ally';

test('verify page accessibility', async ({ page }, testInfo) => {
    await page.goto('https://example.com');

    // Basic scan
    await checkAccessibility(page, testInfo);

    // Advanced scan with configuration
    await checkAccessibility(page, testInfo, {
        verbose: true, // Log results to terminal
        consoleLog: true, // Log results to browser console
        pageKey: 'Homepage', // Custom name for the report file
        tags: ['wcag2a', 'wcag2aa'],
        rules: {
            'color-contrast': { enabled: false },
        },
    });
});
```

---

## <span aria-hidden="true">⚙️</span> Configuration Options

### Reporter Options (in `playwright.config.ts`)

| Option             | Type     | Description                                                     |
| ------------------ | -------- | --------------------------------------------------------------- |
| `outputFolder`     | `string`  | Where to save the reports. Defaults to `steps-report`.          |
| `colors`           | `object`  | Customize severity colors (critical, serious, moderate, minor). |
| `verbose`          | `boolean` | **Default**: `true`. Show violations in terminal.               |
| `consoleLog`       | `boolean` | **Default**: `true`. Show violations in browser console.        |
| `ado`              | `object`  | Azure DevOps configuration for deep linking.                    |
| `ado.organization` | `string` | Your Azure DevOps organization name.                            |
| `ado.project`      | `string` | Your Azure DevOps project name.                                 |
| `ado.areaPath`     | `string` | Optional: The Area Path where bugs should be created.           |

### `checkAccessibility` Options

| Option       | Type       | Description                                                                |
| ------------ | ---------- | -------------------------------------------------------------------------- |
| `include`    | `string`   | CSS selector to limit the scan to a specific element.                      |
| `verbose`    | `boolean`  | **Terminal Logs**: Print violations to terminal. Defaults to `true`.       |
| `consoleLog` | `boolean`  | **Browser Logs**: Print violations to browser console. Defaults to `true`. |
| `rules`      | `object`   | Axe-core rule configuration.                                               |
| `tags`       | `string[]` | List of Axe-core tags to run (e.g., `['wcag2aa']`).                        |
| `pageKey`    | `string`   | Custom identifier for the report file name.                                |

---

## <span aria-hidden="true">🛡️</span> License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

---

## <span aria-hidden="true">⚠️</span> Known Limitations

Automated accessibility testing with Axe-core detects approximately **30–40% of WCAG violations** — those that are deterministic and can be evaluated programmatically, such as:

- Missing `alt` text on images
- Insufficient color contrast
- Missing form labels
- Empty buttons or links
- Missing ARIA roles and attributes

**The remaining ~60–70% require manual testing**, including:

- Keyboard-only navigation walkthroughs
- Screen reader testing (NVDA, VoiceOver, JAWS)
- Cognitive load and reading flow evaluation
- User testing with people with disabilities

snap-ally automates the "easy wins" in your CI/CD pipeline so your team can focus manual effort on the complex interactions that tools cannot evaluate.

---

## <span aria-hidden="true">🤝</span> Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

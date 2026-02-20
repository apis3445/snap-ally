# snap-ally 📸♿

[![npm version](https://img.shields.io/npm/v/snap-ally.svg)](https://www.npmjs.com/package/snap-ally)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A powerful, developer-friendly Playwright reporter for **Accessibility testing** using Axe-core. Beyond just reporting, it provides visual evidence to help developers fix accessibility issues faster.

---

## 📺 Demo

**[▶️ Watch the Demo Video](https://www.loom.com/share/853c04f1f76242a699e8f82e54733007)**

![Demo](https://cdn.loom.com/sessions/thumbnails/853c04f1f76242a699e8f82e54733007-with-play.gif)

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
import { defineConfig } from "@playwright/test";

export default defineConfig({
  reporter: [
    [
      "snap-ally",
      {
        outputFolder: "a11y-report",
        // Optional: Visual Customization
        colors: {
          critical: "#dc2626",
          serious: "#ea580c",
          moderate: "#f59e0b",
          minor: "#0ea5e9",
        },
        // Optional: Azure DevOps Integration
        ado: {
          organization: "your-org",
          project: "your-project",
        },
      },
    ],
  ],
});
```

---

## <span aria-hidden="true">📖</span> Usage

Import and use `scanA11y` within your Playwright tests:

```typescript
import { test } from "@playwright/test";
import { scanA11y } from "snap-ally";

test("verify page accessibility", async ({ page }, testInfo) => {
  await page.goto("https://example.com");

  // Basic scan
  await scanA11y(page, testInfo);

  // Advanced scan with configuration
  await scanA11y(page, testInfo, {
    rules: {
      "color-contrast": { enabled: false }, // Disable specific rule
    },
    tags: ["wcag2a", "wcag2aa"], // Focus on specific WCAG levels
    verbose: true,
    pageKey: "Homepage", // Custom name for the report file
  });
});
```

---

## <span aria-hidden="true">⚙️</span> Configuration Options

### Reporter Options (in `playwright.config.ts`)

| Option             | Type     | Description                                                     |
| ------------------ | -------- | --------------------------------------------------------------- |
| `outputFolder`     | `string` | Where to save the reports. Defaults to `steps-report`.          |
| `colors`           | `object` | Customize severity colors (critical, serious, moderate, minor). |
| `ado`              | `object` | Azure DevOps configuration for deep linking.                    |
| `ado.organization` | `string` | Your Azure DevOps organization name.                            |
| `ado.project`      | `string` | Your Azure DevOps project name.                                 |

### `scanA11y` Options

| Option    | Type       | Description                                           |
| --------- | ---------- | ----------------------------------------------------- |
| `include` | `string`   | CSS selector to limit the scan to a specific element. |
| `verbose` | `boolean`  | Log violations to the console. Defaults to `true`.    |
| `rules`   | `object`   | Axe-core rule configuration.                          |
| `tags`    | `string[]` | List of Axe-core tags to run (e.g., `['wcag2aa']`).   |
| `pageKey` | `string`   | Custom identifier for the report file name.           |

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

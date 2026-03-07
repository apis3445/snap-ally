import * as fs from 'fs';
import * as path from 'path';

/**
 * Handles the rendering of HTML reports using static templates and JSON data injection.
 */
export class A11yHtmlRenderer {
    /**
     * Renders a static HTML template by copying it and generating the accompanied data payload.
     * @param templateName The template file name in the templates folder.
     * @param data The data object to pass to the client-side JS app.
     * @param outputFolder The folder where the rendered file will be saved.
     * @param outputFileName The full path of the output file.
     */
    async render(
        templateName: string,
        data: Record<string, unknown>,
        outputFolder: string,
        outputFileName: string
    ) {
        // Resolve path relative to this file (dist/A11yHtmlRenderer.js)
        const templatesDir = path.join(__dirname, 'templates');
        const templatePath = path.join(templatesDir, templateName);
        const cssPath = path.join(templatesDir, 'global-report-styles.css');
        const jsPath = path.join(templatesDir, 'report-app.js');

        if (!fs.existsSync(templatePath)) {
            throw new Error(`[A11yHtmlRenderer] Template not found: ${templatePath}`);
        }

        if (!fs.existsSync(outputFolder)) {
            fs.mkdirSync(outputFolder, { recursive: true });
        }

        // 1. Copy the pure HTML template to the output location
        fs.copyFileSync(templatePath, outputFileName);

        // 2. Wrap the report data in a JS variable and write data.js next to the HTML file
        const outputDir = path.dirname(outputFileName);
        const dataJsPath = path.join(outputDir, 'data.js');
        const jsContent = `window.snapAllyData = ${JSON.stringify(data)};`;
        fs.writeFileSync(dataJsPath, jsContent, 'utf8');

        // 3. Copy the global CSS and JS rendering engine next to the HTML file
        const outCssPath = path.join(outputDir, 'global-report-styles.css');
        const outJsPath = path.join(outputDir, 'report-app.js');

        try {
            if (fs.existsSync(cssPath)) fs.copyFileSync(cssPath, outCssPath);
        } catch (e) {
            console.error('Error copying CSS:', e);
        }
        try {
            if (fs.existsSync(jsPath)) fs.copyFileSync(jsPath, outJsPath);
        } catch (e) {
            console.error('Error copying JS:', e);
        }
    }

    /**
     * Converts ANSI color codes to HTML spans for nicer error display.
     */
    ansiToHtml(text: string): string {
        const map: Record<string, string> = {
            '\u001b[30m': '<span style="color:black">',
            '\u001b[31m': '<span style="color:red">',
            '\u001b[32m': '<span style="color:green">',
            '\u001b[33m': '<span style="color:yellow">',
            '\u001b[34m': '<span style="color:blue">',
            '\u001b[35m': '<span style="color:magenta">',
            '\u001b[36m': '<span style="color:cyan">',
            '\u001b[37m': '<span style="color:white">',
            '\u001b[0m': '</span>',
            '\u001b[2m': '<span style="opacity:0.5">',
            '\u001b[22m': '</span>',
            '\u001b[39m': '</span>',
        };

        let result = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

        for (const [code, tag] of Object.entries(map)) {
            result = result.split(code).join(tag);
        }
        return result;
    }
}

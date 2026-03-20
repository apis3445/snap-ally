import * as fs from 'fs';
import * as path from 'path';

/**
 * Handles the rendering of HTML reports using static templates and JSON data injection.
 */
export class HtmlRenderer {
    /**
     * Renders a static HTML template by copying it and generating the accompanied data payload.
     */
    async render(
        templateName: string,
        data: Record<string, unknown>,
        _outputFolder: string, // Kept for signature compatibility
        outputFileName: string
    ) {
        // Resolve path relative to this file (dist/core/HtmlRenderer.js)
        const templatesDir = path.join(__dirname, '..', 'templates');
        const templatePath = path.join(templatesDir, templateName);
        const cssPath = path.join(templatesDir, 'global-report-styles.css');
        const jsPath = path.join(templatesDir, 'report-app.js');

        if (!fs.existsSync(templatePath)) {
            throw new Error(`[HtmlRenderer] Template not found: ${templatePath}`);
        }

        let html = fs.readFileSync(templatePath, 'utf8');

        // Inline CSS
        if (fs.existsSync(cssPath)) {
            const css = fs.readFileSync(cssPath, 'utf8');
            html = html.replace(
                '</head>',
                `<style>\n${css}\n</style>\n</head>`
            );
            // Remove the link tag if it exists
            html = html.replace(/<link[^>]*global-report-styles\.css[^>]*>/, '');
        }

        // Inline Data
        const jsData = `window.snapAllyData = ${JSON.stringify(data)};`;
        html = html.replace(
            '<script src="data.js"></script>',
            `<script>\n${jsData}\n</script>`
        );

        // Inline main logic
        if (fs.existsSync(jsPath)) {
            const js = fs.readFileSync(jsPath, 'utf8');
            html = html.replace(
                '<script src="report-app.js"></script>',
                `<script>\n${js}\n</script>`
            );
        }

        // Final cleanup of any potential remaining dummy scripts
        html = html.replace(/<script src="data-[^>]*\.js"><\/script>/, '');

        fs.writeFileSync(outputFileName, html, 'utf8');
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

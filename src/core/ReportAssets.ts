import * as fs from 'fs';
import * as path from 'path';
import { TestResult } from '@playwright/test/reporter';

/**
 * Utilities for managing and copying report assets like videos and screenshots.
 */
export class ReportAssets {
    /**
     * Copies a file from source to a destination folder.
     */
    copyToFolder(destFolder: string, srcPath: string, fileName?: string): string {
        if (!srcPath || !fs.existsSync(srcPath)) {
            return '';
        }

        const name = fileName || path.basename(srcPath);
        const destFile = path.join(destFolder, name);

        if (!fs.existsSync(destFolder)) {
            fs.mkdirSync(destFolder, { recursive: true });
        }

        fs.copyFileSync(srcPath, destFile);
        return name;
    }

    /**
     * Copies all video attachments to the report folder for portability.
     */
    copyVideos(result: TestResult, destFolder: string): string[] {
        return result.attachments
            .filter(
                (a) =>
                    (a.name === 'video' || (a.contentType || '').startsWith('video/')) && a.path
            )
            .map((attachment) => this.copyToFolder(destFolder, attachment.path as string))
            .filter((p) => !!p);
    }

    /**
     * Copies all screenshots found in the test attachments.
     */
    copyScreenshots(result: TestResult, destFolder: string): string[] {
        return result.attachments
            .filter(
                (a) =>
                    a.name === 'screenshot' ||
                    a.name.endsWith('.png') ||
                    (a.contentType || '').startsWith('image/')
            )
            .map((a) => {
                if (a.path) {
                    return this.copyToFolder(destFolder, a.path, a.name !== 'screenshot' ? a.name : undefined);
                } else if (a.body) {
                    const timestamp = Date.now();
                    const name =
                        a.name === 'screenshot'
                            ? `screenshot-${timestamp}.png`
                            : a.name.endsWith('.png')
                                ? a.name
                                : `${a.name}.png`;
                    return this.saveBuffer(destFolder, name, a.body);
                }
                return '';
            })
            .filter((path) => path !== '');
    }

    /**
     * Copies all other attachments (traces, logs, etc.) to the report folder.
     */
    copyAllOtherAttachments(
        result: TestResult,
        destFolder: string
    ): { path: string; name: string }[] {
        const excludedNames = ['screenshot', 'video', 'A11y'];
        return result.attachments
            .filter(
                (a) =>
                    !excludedNames.includes(a.name) &&
                    !a.name.toLowerCase().endsWith('.png') &&
                    !(a.contentType || '').startsWith('image/') &&
                    !(a.contentType || '').startsWith('video/')
            )
            .map((a) => {
                let name = '';
                if (a.path) {
                    name = this.copyToFolder(destFolder, a.path, a.name);
                } else if (a.body) {
                    name = this.saveBuffer(destFolder, a.name, a.body);
                }
                return name ? { path: name, name: a.name } : null;
            })
            .filter((item): item is { path: string; name: string } => item !== null);
    }

    /**
     * Persists an in-memory buffer to a file in the destination folder.
     */
    saveBuffer(destFolder: string, fileName: string, buffer: Buffer): string {
        if (!fs.existsSync(destFolder)) {
            fs.mkdirSync(destFolder, { recursive: true });
        }
        const destFile = path.join(destFolder, fileName);
        fs.writeFileSync(destFile, buffer);
        return fileName;
    }
}

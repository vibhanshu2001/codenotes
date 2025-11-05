import * as crypto from 'crypto';
import * as vscode from 'vscode';

export class HashUtils {
	static hashAroundLine(lines: string[], lineNumber: number, contextSize: number = 3): string {
		const start = Math.max(0, lineNumber - contextSize);
		const end = Math.min(lines.length, lineNumber + contextSize + 1);
		const relevantLines = lines.slice(start, end);
		const content = relevantLines.join('\n');
		return crypto.createHash('sha1').update(content).digest('hex').substring(0, 8);
	}

	static hashLineRange(lines: string[], startLine: number, endLine: number): string {
		const relevantLines = lines.slice(startLine, endLine + 1);
		const content = relevantLines.join('\n');
		return crypto.createHash('sha256').update(content).digest('hex');
	}

	static hashContent(content: string): string {
		return crypto.createHash('sha256').update(content).digest('hex');
	}

	static md5Hash(content: string): string {
		return crypto.createHash('md5').update(content.toLowerCase().trim()).digest('hex');
	}

	static findMatchingLine(lines: string[], targetHash: string, startLine: number, searchRadius: number): number | null {
		const start = Math.max(0, startLine - searchRadius);
		const end = Math.min(lines.length, startLine + searchRadius);

		for (let i = start; i < end; i++) {
			const hash = this.hashAroundLine(lines, i);
			if (hash === targetHash) {
				return i;
			}
		}

		return null;
	}
}


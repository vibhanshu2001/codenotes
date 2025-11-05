import * as vscode from 'vscode';
import { CodeNote } from '../types';
import { NotesManager } from '../core/notesManager';
import { getAuthorColor, getAuthorBorderColor } from '../utils/colorUtils';

export class HoverView {
	private decorationTypes = new Map<string, vscode.TextEditorDecorationType>();

	constructor() {}

	async updateDecorations(editor: vscode.TextEditor): Promise<void> {
		const workspaceFolder = vscode.workspace.getWorkspaceFolder(editor.document.uri);
		if (!workspaceFolder) {
			return;
		}

		const filePath = editor.document.uri.fsPath;
		this.decorationTypes.forEach(decoration => {
			editor.setDecorations(decoration, []);
		});

		const notes = await NotesManager.getNotesForFile(workspaceFolder, filePath);

		const rangeMap = new Map<string, CodeNote[]>();
		notes.forEach(note => {
			const key = `${note.range.start}-${note.range.end}`;
			const existing = rangeMap.get(key) || [];
			existing.push(note);
			rangeMap.set(key, existing);
		});

		const authorDecorations = new Map<string, vscode.DecorationOptions[]>();

		rangeMap.forEach((notesAtRange, rangeKey) => {
			const sortedNotes = [...notesAtRange].sort((a, b) => 
				new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
			);
			const dominantNote = sortedNotes[0];
			
			const [startLine, endLine] = rangeKey.split('-').map(Number);
			const start = Math.min(startLine, editor.document.lineCount - 1);
			const end = Math.min(endLine, editor.document.lineCount - 1);
			
			const startPos = editor.document.lineAt(start).range.start;
			const endPos = editor.document.lineAt(end).range.end;
			const range = new vscode.Range(startPos, endPos);

			const hoverMessage = this.createHoverMessage(sortedNotes, filePath, startLine, endLine);

			const colorKey = dominantNote.authorEmail || dominantNote.authorName;
			const decorations = authorDecorations.get(colorKey) || [];
			decorations.push({ range, hoverMessage });
			authorDecorations.set(colorKey, decorations);
		});

		authorDecorations.forEach((decorations, authorKey) => {
			let decorationType = this.decorationTypes.get(authorKey);
			if (!decorationType) {
				const notes = Array.from(rangeMap.values()).flat();
				const authorNote = notes.find(n => 
					(n.authorEmail || n.authorName) === authorKey
				);
				const backgroundColor = getAuthorColor(authorNote?.authorEmail || null, authorNote?.authorName);
				const borderColor = getAuthorBorderColor(authorNote?.authorEmail || null, authorNote?.authorName);

				decorationType = vscode.window.createTextEditorDecorationType({
					backgroundColor,
					borderWidth: '0 0 0 3px',
					borderStyle: 'solid',
					borderColor,
					isWholeLine: false,
					overviewRulerColor: borderColor,
					overviewRulerLane: vscode.OverviewRulerLane.Left
				});
				this.decorationTypes.set(authorKey, decorationType);
			}

			editor.setDecorations(decorationType, decorations);
		});
	}

	public static hoverContext: Map<string, { filePath: string; startLine: number; endLine: number }> = new Map();

	private createHoverMessage(notes: CodeNote[], absoluteFilePath: string, startLine: number, endLine: number): vscode.MarkdownString {
		const hover = new vscode.MarkdownString();
		hover.isTrusted = true;
		hover.supportHtml = false;
		
		const contextKey = `${absoluteFilePath}:${startLine}:${endLine}`;
		HoverView.hoverContext.set(contextKey, { filePath: absoluteFilePath, startLine, endLine });
		
		if (notes.length === 1) {
			const note = notes[0];
			hover.appendMarkdown(`### 📝 CodeNote\n\n`);
			
			let displayText = note.noteText;
			if (note.mentions && note.mentions.length > 0) {
				note.mentions.forEach(mention => {
					displayText = displayText.replace(new RegExp(`@${mention}`, 'g'), `**@${mention}**`);
				});
			}
			
			hover.appendMarkdown(`${displayText}\n\n`);
			hover.appendMarkdown(`---\n\n`);
			
			hover.appendMarkdown(`**Author:** ${note.authorName}`);
			if (note.authorEmail) {
				hover.appendMarkdown(` <${note.authorEmail}>`);
			}
			hover.appendMarkdown(`\n\n`);
			
			const timeAgo = this.getTimeAgo(note.timestamp);
			hover.appendMarkdown(`**Created:** ${timeAgo}\n\n`);
			
			if (note.range.start === note.range.end) {
				hover.appendMarkdown(`**Line:** ${note.range.start + 1}`);
			} else {
				hover.appendMarkdown(`**Lines:** ${note.range.start + 1}-${note.range.end + 1}`);
			}
			
			if (note.functionName) {
				hover.appendMarkdown(` • **Function:** \`${note.functionName}()\``);
			}
			
			hover.appendMarkdown(`\n\n[📋 View in Panel](command:codenotes.showNotesAtRange?${encodeURIComponent(contextKey)})`);
		} else {
			hover.appendMarkdown(`### 📝 ${notes.length} CodeNotes\n\n`);
			hover.appendMarkdown(`[📋 View All CodeNotes](command:codenotes.showNotesAtRange?${encodeURIComponent(contextKey)}) | *or press Ctrl+Shift+V*\n\n`);
			hover.appendMarkdown(`---\n\n`);

			const note = notes[0];
			const preview = note.noteText.length > 60 
				? note.noteText.substring(0, 57) + '...' 
				: note.noteText;
			hover.appendMarkdown(`**${note.authorName}:** ${preview}\n\n`);
			hover.appendMarkdown(`*${notes.length - 1} more CodeNote${notes.length > 2 ? 's' : ''}...*`);
		}
		
		return hover;
	}

	private getTimeAgo(timestamp: string): string {
		const now = new Date();
		const created = new Date(timestamp);
		const diffMs = now.getTime() - created.getTime();
		
		const minutes = Math.floor(diffMs / 60000);
		const hours = Math.floor(diffMs / 3600000);
		const days = Math.floor(diffMs / 86400000);
		
		if (minutes < 1) {
			return 'just now';
		}
		if (minutes < 60) {
			return `${minutes}m ago`;
		}
		if (hours < 24) {
			return `${hours}h ago`;
		}
		if (days < 7) {
			return `${days}d ago`;
		}
		return created.toLocaleDateString();
	}

	async refreshAllEditors(): Promise<void> {
		for (const editor of vscode.window.visibleTextEditors) {
			await this.updateDecorations(editor);
		}
	}

	dispose(): void {
		this.decorationTypes.forEach(decoration => decoration.dispose());
		this.decorationTypes.clear();
	}
}


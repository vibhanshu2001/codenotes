import * as vscode from 'vscode';
import * as path from 'path';
import { CodeNote } from '../types';
import { NotesManager } from '../core/notesManager';
import { getAuthorColorIndex } from '../utils/colorUtils';

export class AuthorLegendItem extends vscode.TreeItem {
	constructor(
		public readonly authorName: string,
		public readonly authorEmail: string | null,
		public readonly color: string
	) {
		super(`${authorName}`, vscode.TreeItemCollapsibleState.None);
		this.description = authorEmail || '';
		this.contextValue = 'legend';
		
		const colorTheme = this.getColorThemeFromHex(color);
		this.iconPath = new vscode.ThemeIcon('circle-filled', new vscode.ThemeColor(colorTheme));
		
		this.tooltip = `${authorName} - All notes by this author are highlighted in this color`;
	}
	
	private getColorThemeFromHex(color: string): string {
		const authorEmail = this.authorEmail || null;
		const authorName = this.authorName;
		const index = getAuthorColorIndex(authorEmail, authorName);
		
		const colorThemes = [
			'charts.blue',
			'charts.green',
			'charts.yellow',
			'charts.red',
			'charts.purple',
			'charts.orange'
		];
		
		return colorThemes[index] || 'charts.blue';
	}
}

export class NoteItem extends vscode.TreeItem {
	constructor(
		public readonly note: CodeNote,
		public readonly workspaceFolder: vscode.WorkspaceFolder
	) {
		const preview = note.noteText.length > 60 ? note.noteText.substring(0, 57) + '...' : note.noteText;
		super(preview, vscode.TreeItemCollapsibleState.None);
		
		const timeAgo = this.getTimeAgo(note.timestamp);
		const rangeStr = note.range.start === note.range.end 
			? `L${note.range.start + 1}` 
			: `L${note.range.start + 1}-${note.range.end + 1}`;
		
		this.tooltip = new vscode.MarkdownString();
		this.tooltip.appendMarkdown(`${note.noteText}\n\n`);
		this.tooltip.appendMarkdown(`**ID:** \`${note.id}\`\n\n`);
		this.tooltip.appendMarkdown(`---\n\n`);
		this.tooltip.appendMarkdown(`**Author:** ${note.authorName}`);
		if (note.authorEmail) {
			this.tooltip.appendMarkdown(` <${note.authorEmail}>`);
		}
		this.tooltip.appendMarkdown(`\n\n**Range:** ${rangeStr}\n\n`);
		if (note.gitBranch || note.gitCommit) {
			if (note.gitBranch) {
				this.tooltip.appendMarkdown(`**Branch:** \`${note.gitBranch}\`  `);
			}
			if (note.gitCommit) {
				this.tooltip.appendMarkdown(`**Commit:** \`${note.gitCommit}\`\n\n`);
			}
		}
		if (note.functionName) {
			this.tooltip.appendMarkdown(`**Function:** \`${note.functionName}()\`\n\n`);
		}
		if (note.mentions && note.mentions.length > 0) {
			this.tooltip.appendMarkdown(`**Mentions:** ${note.mentions.map(m => `@${m}`).join(', ')}\n\n`);
		}
		if (note.isOutdated) {
			this.tooltip.appendMarkdown(`⚠️ **Outdated**: Code content changed since note was added\n\n`);
		}
		this.tooltip.appendMarkdown(`**Created:** ${timeAgo}`);
		
		const outdatedPrefix = note.isOutdated ? '⚠️ ' : '';
		this.description = `${outdatedPrefix}${note.authorName} • ${rangeStr} • ${timeAgo}`;
		
		this.contextValue = 'note';
		const iconColor = note.isOutdated ? 'charts.red' : 'charts.yellow';
		this.iconPath = new vscode.ThemeIcon('note', new vscode.ThemeColor(iconColor));
		
		this.command = {
			command: 'codenotes.openNoteInPanel',
			title: 'Open CodeNote in Panel',
			arguments: [this.note, this.workspaceFolder]
		};
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
}

export class FileItem extends vscode.TreeItem {
	constructor(
		public readonly filePath: string,
		public readonly workspaceFolder: vscode.WorkspaceFolder,
		public readonly noteCount: number
	) {
		super(path.basename(filePath), vscode.TreeItemCollapsibleState.Expanded);
		
		this.tooltip = filePath;
		this.description = `${noteCount} note${noteCount !== 1 ? 's' : ''}`;
		this.contextValue = 'file';
		this.iconPath = new vscode.ThemeIcon('file-code');
	}
}

export class LegendHeader extends vscode.TreeItem {
	constructor() {
		super('Author Colors', vscode.TreeItemCollapsibleState.Expanded);
		this.contextValue = 'legendHeader';
		this.iconPath = new vscode.ThemeIcon('symbol-color');
	}
}

export class SidebarView implements vscode.TreeDataProvider<FileItem | NoteItem | AuthorLegendItem | LegendHeader> {
	private _onDidChangeTreeData = new vscode.EventEmitter<FileItem | NoteItem | AuthorLegendItem | LegendHeader | undefined | null | void>();
	readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

	constructor(private workspaceFolder: vscode.WorkspaceFolder) {}

	refresh(): void {
		this._onDidChangeTreeData.fire();
	}

	getTreeItem(element: FileItem | NoteItem | AuthorLegendItem | LegendHeader): vscode.TreeItem {
		return element;
	}

	async getChildren(element?: FileItem | NoteItem | AuthorLegendItem | LegendHeader): Promise<(FileItem | NoteItem | AuthorLegendItem | LegendHeader)[]> {
		if (!element) {
			const notes = await NotesManager.loadNotes(this.workspaceFolder);
			
			if (notes.length === 0) {
				return [];
			}
			
			const fileMap = new Map<string, CodeNote[]>();

			notes.forEach(note => {
				const existing = fileMap.get(note.filePath) || [];
				existing.push(note);
				fileMap.set(note.filePath, existing);
			});

			const fileItems: FileItem[] = [];
			fileMap.forEach((notes, filePath) => {
				fileItems.push(new FileItem(filePath, this.workspaceFolder, notes.length));
			});

			const sortedFiles = fileItems.sort((a, b) => a.filePath.localeCompare(b.filePath));
			
			const authors = await NotesManager.getAllAuthors(this.workspaceFolder);
			if (authors.length > 0) {
				return [...sortedFiles, new LegendHeader()];
			}
			
			return sortedFiles;
		} else if (element instanceof LegendHeader) {
			const authors = await NotesManager.getAllAuthors(this.workspaceFolder);
			return authors.map(author => new AuthorLegendItem(author.name, author.email, author.color));
		} else if (element instanceof FileItem) {
			const notes = await NotesManager.loadNotes(this.workspaceFolder);
			const fileNotes = notes.filter(n => n.filePath === element.filePath);
			
			return fileNotes
				.sort((a, b) => a.range.start - b.range.start)
				.map(note => new NoteItem(note, this.workspaceFolder));
		}

		return [];
	}
}


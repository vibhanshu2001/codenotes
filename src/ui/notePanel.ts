import * as vscode from 'vscode';
import { CodeNote } from '../types';
import { getAuthorBorderColor } from '../utils/colorUtils';
import { getInitials, getAvatarColorForName } from '../utils/authorUtils';
import { HashUtils } from '../utils/hashUtils';
import { NotesManager } from '../core/notesManager';
import { GitUtils } from '../core/gitUtils';

export class NotePanel {
	private static currentPanel: NotePanel | undefined;
	private readonly panel: vscode.WebviewPanel;
	private notes: CodeNote[];
	private disposables: vscode.Disposable[] = [];

	private constructor(
		panel: vscode.WebviewPanel,
		notes: CodeNote[],
		private onEdit: (note: CodeNote) => void,
		private onDelete: (note: CodeNote) => void,
		private currentAuthor: string,
		private currentAuthorEmail: string | null
	) {
		this.panel = panel;
		this.notes = notes.sort((a, b) => 
			new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
		);
		this.update();

		this.panel.onDidDispose(() => this.dispose(), null, this.disposables);

		this.panel.webview.onDidReceiveMessage(
			async message => {
				switch (message.command) {
					case 'edit':
						const editNote = this.notes.find(n => n.id === message.noteId);
						if (editNote) {
							this.onEdit(editNote);
						}
						break;
					case 'delete':
						const deleteNote = this.notes.find(n => n.id === message.noteId);
						if (deleteNote) {
							this.onDelete(deleteNote);
						}
						break;
					case 'copyId':
						vscode.env.clipboard.writeText(message.noteId);
						vscode.window.showInformationMessage('CodeNote ID copied to clipboard!');
						break;
					case 'openNote':
						await this.handleOpenNote(message.noteId);
						break;
				}
			},
			null,
			this.disposables
		);
	}

	public static show(
		notes: CodeNote[],
		onEdit: (note: CodeNote) => void,
		onDelete: (note: CodeNote) => void,
		currentAuthor: string,
		currentAuthorEmail: string | null
	) {
		if (NotePanel.currentPanel) {
			NotePanel.currentPanel.notes = notes.sort((a, b) => 
				new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
			);
			NotePanel.currentPanel.update();
			NotePanel.currentPanel.panel.reveal(vscode.ViewColumn.Beside);
		} else {
			const panel = vscode.window.createWebviewPanel(
				'notePanel',
				'Notes',
				{
					viewColumn: vscode.ViewColumn.Beside,
					preserveFocus: true
				},
				{
					enableScripts: true,
					retainContextWhenHidden: true
				}
			);

			NotePanel.currentPanel = new NotePanel(
				panel,
				notes,
				onEdit,
				onDelete,
				currentAuthor,
				currentAuthorEmail
			);
		}
	}

	public updateNotes(notes: CodeNote[]) {
		this.notes = notes.sort((a, b) => 
			new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
		);
		this.update();
	}

	private update() {
		this.panel.webview.html = this.getHtmlContent();
		const rangeStr = this.notes.length > 0 && this.notes[0].range.start === this.notes[0].range.end
			? `Line ${this.notes[0].range.start + 1}`
			: `Lines ${this.notes[0].range.start + 1}-${this.notes[0].range.end + 1}`;
		this.panel.title = `${this.notes.length} CodeNote${this.notes.length !== 1 ? 's' : ''} • ${rangeStr}`;
	}

	private getHtmlContent(): string {
		const notesHtml = this.notes.map((note, index) => {
			const timeAgo = this.getTimeAgo(note.timestamp);
			const isOwnNote = note.authorEmail 
				? note.authorEmail === this.currentAuthorEmail
				: note.authorName === this.currentAuthor;
			
			const borderColor = getAuthorBorderColor(note.authorEmail, note.authorName);
			const initials = getInitials(note.authorName);
			const avatarColor = getAvatarColorForName(note.authorName);
			
			// Get Gravatar URL or use initials
			const gravatarUrl = note.authorEmail 
				? `https://www.gravatar.com/avatar/${HashUtils.md5Hash(note.authorEmail)}?d=identicon&s=32`
				: null;
			
			let safeText = note.noteText
				.replace(/&/g, '&amp;')
				.replace(/</g, '&lt;')
				.replace(/>/g, '&gt;')
				.replace(/"/g, '&quot;')
				.replace(/'/g, '&#039;');
			
			const noteTextWithLinks = safeText
				.replace(/@([a-zA-Z0-9_]+)/g, '@$1')
				.replace(/#([a-zA-Z0-9_]+)/g, '<a href="#" data-note-id="$1" style="color: #4A90E2; text-decoration: underline; cursor: pointer;" onclick="openNote(\'$1\'); return false;">#$1</a>');

			return `
				<div class="note-card ${note.isOutdated ? 'outdated' : ''}" style="border-left-color: ${borderColor};">
					<div class="note-header">
						<div class="avatar-container">
							${gravatarUrl ? `
								<img src="${gravatarUrl}" class="avatar" alt="${initials}" />
							` : `
								<div class="avatar" style="background-color: ${avatarColor};">
									${initials}
								</div>
							`}
						</div>
						<div class="author-info">
							<div class="author-name">${this.escapeHtml(note.authorName)}</div>
							${note.authorEmail ? `<div class="author-email">${this.escapeHtml(note.authorEmail)}</div>` : ''}
							${note.gitBranch || note.gitCommit ? `
							<div class="git-info">
								${note.gitBranch ? `<span class="git-branch">🌿 ${this.escapeHtml(note.gitBranch)}</span>` : ''}
								${note.gitCommit ? `<span class="git-commit">📌 ${this.escapeHtml(note.gitCommit)}</span>` : ''}
							</div>
							` : ''}
						</div>
						<div class="timestamp-container">
							<div class="timestamp">${timeAgo}</div>
							${note.isOutdated ? '<div class="outdated-badge" title="Code content changed since note was added">⚠️ Outdated</div>' : ''}
						</div>
					</div>
					
					<div class="note-content">${noteTextWithLinks}</div>
					
					${note.mentions && note.mentions.length > 0 ? `
					<div class="mentions">
						${note.mentions.map(m => `<span class="mention-chip">@${this.escapeHtml(m)}</span>`).join('')}
					</div>
					` : ''}
					
					<div class="note-meta">
						<div class="meta-item note-id-item">
							<span class="meta-icon">🔖</span>
							<span class="note-id">${note.id}</span>
							<button class="copy-id-btn" onclick="copyId('${note.id}')" title="Copy Note ID">
								📋
							</button>
						</div>
						${note.functionName ? `
						<div class="meta-item">
							<span class="meta-icon">⚡</span>
							<span>${this.escapeHtml(note.functionName)}()</span>
						</div>
						` : ''}
						<div class="meta-item">
							<span class="meta-icon">📅</span>
							<span>${new Date(note.timestamp).toLocaleString()}</span>
						</div>
					</div>

					${isOwnNote ? `
					<div class="note-actions">
						<button class="action-btn edit-btn" onclick="edit('${note.id}')">
							✏️ Edit
						</button>
						<button class="action-btn delete-btn" onclick="deleteNote('${note.id}')">
							🗑️ Delete
						</button>
					</div>
					` : ''}
				</div>
			`;
		}).join('');

		return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<style>
		* {
			margin: 0;
			padding: 0;
			box-sizing: border-box;
		}
		
		body {
			font-family: var(--vscode-font-family);
			font-size: var(--vscode-font-size);
			color: var(--vscode-foreground);
			background: var(--vscode-editor-background);
			padding: 12px;
			line-height: 1.5;
			overflow-x: hidden;
			max-width: 100%;
		}
		
		.note-card {
			background: var(--vscode-editor-background);
			border: 1px solid var(--vscode-panel-border);
			border-left: 4px solid;
			border-radius: 4px;
			padding: 12px;
			margin-bottom: 12px;
			box-shadow: 0 2px 4px rgba(0,0,0,0.1);
			width: 100%;
			max-width: 100%;
		}
		
		.note-header {
			display: flex;
			gap: 10px;
			align-items: flex-start;
			margin-bottom: 10px;
			padding-bottom: 8px;
			border-bottom: 1px solid var(--vscode-panel-border);
			flex-wrap: wrap;
		}
		
		.avatar-container {
			flex-shrink: 0;
		}
		
		.avatar {
			width: 32px;
			height: 32px;
			min-width: 32px;
			border-radius: 50%;
			display: flex;
			align-items: center;
			justify-content: center;
			font-weight: 600;
			font-size: 12px;
			color: white;
		}
		
		.author-info {
			flex: 1;
			min-width: 0;
			max-width: 100%;
		}
		
		.author-name {
			font-weight: 600;
			font-size: 14px;
			color: var(--vscode-foreground);
			margin-bottom: 2px;
			word-break: break-word;
		}
		
		.author-email {
			font-size: 11px;
			color: var(--vscode-descriptionForeground);
			font-family: var(--vscode-editor-font-family);
			margin-bottom: 4px;
			word-break: break-all;
		}
		
		.git-info {
			display: flex;
			gap: 8px;
			flex-wrap: wrap;
			font-size: 10px;
			color: var(--vscode-descriptionForeground);
			margin-top: 4px;
		}
		
		.git-branch, .git-commit {
			background: var(--vscode-badge-background);
			padding: 2px 6px;
			border-radius: 3px;
			font-family: var(--vscode-editor-font-family);
			word-break: break-all;
		}
		
		.timestamp-container {
			text-align: right;
			flex-shrink: 0;
			min-width: fit-content;
		}
		
		.timestamp {
			font-size: 11px;
			color: var(--vscode-descriptionForeground);
			white-space: nowrap;
		}
		
		.outdated-badge {
			font-size: 10px;
			color: #f44336;
			margin-top: 4px;
			font-weight: 600;
		}
		
		.outdated {
			border-left-width: 4px;
			opacity: 0.9;
		}
		
		.note-content {
			margin: 12px 0;
			white-space: pre-wrap;
			word-wrap: break-word;
			word-break: break-word;
			overflow-wrap: break-word;
			line-height: 1.6;
			font-size: 13px;
			max-width: 100%;
		}
		
		.note-content a {
			cursor: pointer;
			text-decoration: none;
		}
		
		.note-content a:hover {
			text-decoration: underline;
		}
		
		.mentions {
			display: flex;
			flex-wrap: wrap;
			gap: 6px;
			margin: 8px 0;
		}
		
		.mention-chip {
			background: rgba(74, 144, 226, 0.15);
			color: #4A90E2;
			padding: 2px 8px;
			border-radius: 12px;
			font-size: 11px;
			font-weight: 600;
			border: 1px solid rgba(74, 144, 226, 0.3);
		}
		
		.note-meta {
			display: flex;
			flex-wrap: wrap;
			gap: 12px;
			margin-top: 12px;
			padding-top: 8px;
			border-top: 1px solid var(--vscode-panel-border);
			font-size: 11px;
			color: var(--vscode-descriptionForeground);
		}
		
		.meta-item {
			display: flex;
			align-items: center;
			gap: 4px;
			flex-wrap: wrap;
			min-width: 0;
		}
		
		.note-id-item {
			flex: 1;
			min-width: 0;
			max-width: 100%;
		}
		
		.note-id {
			font-family: var(--vscode-editor-font-family);
			font-size: 10px;
			opacity: 0.7;
			word-break: break-all;
		}
		
		.copy-id-btn {
			background: transparent;
			border: none;
			cursor: pointer;
			padding: 2px 6px;
			border-radius: 3px;
			font-size: 14px;
			opacity: 0.6;
			transition: all 0.2s;
			flex-shrink: 0;
		}
		
		.copy-id-btn:hover {
			opacity: 1;
			background: var(--vscode-button-secondaryBackground);
		}
		
		.copy-id-btn:active {
			transform: scale(0.95);
		}
		
		.meta-icon {
			opacity: 0.7;
		}
		
		.note-actions {
			display: flex;
			gap: 8px;
			margin-top: 12px;
			justify-content: flex-end;
			flex-wrap: wrap;
		}
		
		.action-btn {
			background: var(--vscode-button-secondaryBackground);
			color: var(--vscode-button-secondaryForeground);
			border: none;
			padding: 6px 12px;
			cursor: pointer;
			border-radius: 3px;
			font-size: 12px;
			display: flex;
			align-items: center;
			gap: 4px;
			transition: background 0.2s;
			white-space: nowrap;
		}
		
		.action-btn:hover {
			background: var(--vscode-button-secondaryHoverBackground);
		}
		
		.action-btn:active {
			transform: translateY(1px);
		}
		
		.delete-btn:hover {
			background: var(--vscode-inputValidation-errorBackground);
		}
		
		.empty-state {
			text-align: center;
			padding: 48px 24px;
			color: var(--vscode-descriptionForeground);
		}
		
		.empty-state-icon {
			font-size: 48px;
			margin-bottom: 16px;
			opacity: 0.5;
		}
		
		@media (max-width: 600px) {
			body {
				padding: 8px;
			}
			
			.note-card {
				padding: 10px;
			}
			
			.note-header {
				flex-direction: column;
			}
			
			.timestamp-container {
				text-align: left;
				width: 100%;
			}
			
			.note-actions {
				width: 100%;
			}
			
			.action-btn {
				flex: 1;
				justify-content: center;
			}
		}
	</style>
</head>
<body>
	${this.notes.length > 0 ? notesHtml : `
		<div class="empty-state">
			<div class="empty-state-icon">📝</div>
			<div>No CodeNotes found</div>
		</div>
	`}

	<script>
		const vscode = acquireVsCodeApi();

		function edit(noteId) {
			vscode.postMessage({ command: 'edit', noteId });
		}

		function deleteNote(noteId) {
			vscode.postMessage({ command: 'delete', noteId });
		}
		
		function copyId(noteId) {
			vscode.postMessage({ command: 'copyId', noteId });
		}
		
		function openNote(noteId) {
			vscode.postMessage({ command: 'openNote', noteId });
		}
	</script>
</body>
</html>`;
	}

	private escapeHtml(text: string): string {
		return text
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;')
			.replace(/'/g, '&#039;');
	}

	private escapeHtmlExceptTags(html: string): string {
		const parts: string[] = [];
		let lastIndex = 0;
		const tagRegex = /<(span|a|\/span|\/a)[^>]*>/g;
		let match;

		while ((match = tagRegex.exec(html)) !== null) {
			if (match.index > lastIndex) {
				const textPart = html.substring(lastIndex, match.index);
				parts.push(this.escapeHtml(textPart));
			}
			parts.push(match[0]);
			lastIndex = match.index + match[0].length;
		}

		if (lastIndex < html.length) {
			parts.push(this.escapeHtml(html.substring(lastIndex)));
		}

		return parts.join('');
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

	private async handleOpenNote(noteId: string): Promise<void> {
		try {
			const workspaceFolder = vscode.workspace.workspaceFolders![0];
			const allNotes = await NotesManager.loadNotes(workspaceFolder);
			const targetNote = allNotes.find(n => n.id === noteId);
			
			if (!targetNote) {
				vscode.window.showErrorMessage(`CodeNote #${noteId} not found`);
				return;
			}

			const path = require('path');
			let absolutePath: string;
			
			if (path.isAbsolute(targetNote.filePath)) {
				absolutePath = targetNote.filePath;
			} else {
				absolutePath = path.join(workspaceFolder.uri.fsPath, targetNote.filePath);
			}
			
			const fileUri = vscode.Uri.file(absolutePath);
			
			const document = await vscode.workspace.openTextDocument(fileUri);
			const editor = await vscode.window.showTextDocument(document, vscode.ViewColumn.One);
			
			const range = new vscode.Range(
				targetNote.range.start,
				0,
				targetNote.range.end,
				document.lineAt(targetNote.range.end).text.length
			);
			
			editor.selection = new vscode.Selection(range.start, range.start);
			editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
			
			const notesAtLocation = allNotes.filter(n => 
				n.filePath === targetNote.filePath &&
				n.range.start === targetNote.range.start &&
				n.range.end === targetNote.range.end
			);
			
			const { getExtensionContext } = await import('../extension.js');
			const author = await GitUtils.getAuthorInfo(getExtensionContext());
			
			NotePanel.show(
				notesAtLocation,
				this.onEdit,
				this.onDelete,
				author.name,
				author.email
			);
		} catch (error: any) {
			vscode.window.showErrorMessage(`Failed to open CodeNote: ${error.message}`);
			console.error('handleOpenNote error:', error);
		}
	}

	public dispose() {
		NotePanel.currentPanel = undefined;

		this.panel.dispose();

		while (this.disposables.length) {
			const disposable = this.disposables.pop();
			if (disposable) {
				disposable.dispose();
			}
		}
	}
}

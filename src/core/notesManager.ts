import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { CodeNote, NotesData } from '../types';
import { HashUtils } from '../utils/hashUtils';
import { parseMentions } from '../utils/textUtils';
import { getAuthorBorderColor } from '../utils/colorUtils';

export class NotesManager {
	private static readonly FILENAME = '.codenotes';
	private static notesCache: Map<string, CodeNote[]> = new Map();

	static getNotesFilePath(workspaceFolder: vscode.WorkspaceFolder): string {
		return path.join(workspaceFolder.uri.fsPath, this.FILENAME);
	}

	static async loadNotes(workspaceFolder: vscode.WorkspaceFolder): Promise<CodeNote[]> {
		const notesPath = this.getNotesFilePath(workspaceFolder);
		const cacheKey = workspaceFolder.uri.fsPath;

		try {
			if (fs.existsSync(notesPath)) {
				const content = fs.readFileSync(notesPath, 'utf-8').trim();
				
				if (!content || content.length === 0) {
					this.notesCache.set(cacheKey, []);
					return [];
				}

				let data: NotesData;
				try {
					data = JSON.parse(content);
				} catch (parseError: any) {
					if (parseError instanceof SyntaxError) {
						if (parseError.message.includes('Unexpected end of JSON input')) {
							vscode.window.showWarningMessage(
								'CodeNotes: The .codenotes file appears to be empty or incomplete. It will be reset to an empty notes structure.',
								'Fix Now'
							).then(selection => {
								if (selection === 'Fix Now') {
									this.saveNotes(workspaceFolder, []);
								}
							});
							this.notesCache.set(cacheKey, []);
							return [];
						} else {
							vscode.window.showErrorMessage(
								`CodeNotes: Invalid JSON format in .codenotes file. Error: ${parseError.message}. Please check the file format.`,
								'Open File'
							).then(selection => {
								if (selection === 'Open File') {
									vscode.workspace.openTextDocument(notesPath).then(doc => {
										vscode.window.showTextDocument(doc);
									});
								}
							});
							throw parseError;
						}
					}
					throw parseError;
				}

				if (!data || typeof data !== 'object') {
					vscode.window.showErrorMessage(
						'CodeNotes: Invalid .codenotes file format. Expected an object with a "notes" array.',
						'Reset File'
					).then(selection => {
						if (selection === 'Reset File') {
							this.saveNotes(workspaceFolder, []);
						}
					});
					this.notesCache.set(cacheKey, []);
					return [];
				}

				if (!Array.isArray(data.notes)) {
					vscode.window.showErrorMessage(
						'CodeNotes: Invalid .codenotes file format. The "notes" field must be an array.',
						'Reset File'
					).then(selection => {
						if (selection === 'Reset File') {
							this.saveNotes(workspaceFolder, []);
						}
					});
					this.notesCache.set(cacheKey, []);
					return [];
				}
				
				const migratedNotes = data.notes.map(note => {
					if (!note.range && (note as any).lineNumber !== undefined) {
						const lineNumber = (note as any).lineNumber;
						return {
							...note,
							range: { start: lineNumber, end: lineNumber }
						};
					}
					const cleanNote: CodeNote = {
						id: note.id,
						filePath: note.filePath,
						functionName: note.functionName,
						codeHash: note.codeHash,
						range: note.range,
						noteText: note.noteText,
						authorName: note.authorName,
						authorEmail: note.authorEmail,
						timestamp: note.timestamp,
						contentHash: note.contentHash || '',
						gitBranch: note.gitBranch,
						gitCommit: note.gitCommit,
						mentions: note.mentions || [],
						isOutdated: note.isOutdated
					};
					return cleanNote;
				});
				
				this.notesCache.set(cacheKey, migratedNotes);
				return migratedNotes;
			}
		} catch (error: any) {
			if (error instanceof SyntaxError) {
				vscode.window.showErrorMessage(
					`CodeNotes: Failed to parse .codenotes file. Invalid JSON format: ${error.message}`,
					'Open File'
				).then(selection => {
					if (selection === 'Open File') {
						vscode.workspace.openTextDocument(notesPath).then(doc => {
							vscode.window.showTextDocument(doc);
						});
					}
				});
			} else {
				vscode.window.showErrorMessage(`CodeNotes: Failed to load notes: ${error.message || error}`);
			}
		}

		this.notesCache.set(cacheKey, []);
		return [];
	}

	static async saveNotes(workspaceFolder: vscode.WorkspaceFolder, notes: CodeNote[]): Promise<void> {
		const notesPath = this.getNotesFilePath(workspaceFolder);
		const cacheKey = workspaceFolder.uri.fsPath;

		try {
			const data: NotesData = { notes };
			fs.writeFileSync(notesPath, JSON.stringify(data, null, 2), 'utf-8');
			this.notesCache.set(cacheKey, notes);
		} catch (error) {
			vscode.window.showErrorMessage(`Failed to save notes: ${error}`);
			throw error;
		}
	}

	static async addNote(workspaceFolder: vscode.WorkspaceFolder, note: CodeNote): Promise<void> {
		const notes = await this.loadNotes(workspaceFolder);
		notes.push(note);
		await this.saveNotes(workspaceFolder, notes);
	}

	static async deleteNote(workspaceFolder: vscode.WorkspaceFolder, noteId: string): Promise<void> {
		const notes = await this.loadNotes(workspaceFolder);
		const filtered = notes.filter(n => n.id !== noteId);
		await this.saveNotes(workspaceFolder, filtered);
	}

	static async updateNote(workspaceFolder: vscode.WorkspaceFolder, noteId: string, newText: string): Promise<void> {
		const notes = await this.loadNotes(workspaceFolder);
		const note = notes.find(n => n.id === noteId);
		if (note) {
			note.noteText = newText;
			note.mentions = parseMentions(newText);
			note.timestamp = new Date().toISOString();
			await this.saveNotes(workspaceFolder, notes);
		}
	}

	static async getNotesForFile(workspaceFolder: vscode.WorkspaceFolder, filePath: string): Promise<CodeNote[]> {
		const notes = await this.loadNotes(workspaceFolder);
		const relativePath = path.relative(workspaceFolder.uri.fsPath, filePath);
		return notes.filter(n => n.filePath === relativePath || n.filePath === filePath);
	}

	static async checkAndMarkOutdated(
		workspaceFolder: vscode.WorkspaceFolder,
		filePath: string,
		document: vscode.TextDocument
	): Promise<void> {
		const notes = await this.getNotesForFile(workspaceFolder, filePath);
		const lines = document.getText().split('\n');
		let hasChanges = false;

		for (const note of notes) {
			const currentHash = HashUtils.hashLineRange(lines, note.range.start, note.range.end);
			const wasOutdated = note.isOutdated || false;
			note.isOutdated = currentHash !== note.contentHash;
			
			if (wasOutdated !== note.isOutdated) {
				hasChanges = true;
			}
		}

		if (hasChanges) {
			const allNotes = await this.loadNotes(workspaceFolder);
			await this.saveNotes(workspaceFolder, allNotes);
		}
	}

	static async getAllAuthors(workspaceFolder: vscode.WorkspaceFolder): Promise<Array<{ name: string; email: string | null; color: string }>> {
		const notes = await this.loadNotes(workspaceFolder);
		const authorMap = new Map<string, { name: string; email: string | null }>();
		
		notes.forEach(note => {
			const key = note.authorEmail || note.authorName;
			if (!authorMap.has(key)) {
				authorMap.set(key, { name: note.authorName, email: note.authorEmail });
			}
		});

		return Array.from(authorMap.values()).map(author => ({
			...author,
			color: getAuthorBorderColor(author.email, author.name)
		}));
	}

	static clearCache(): void {
		this.notesCache.clear();
	}
}


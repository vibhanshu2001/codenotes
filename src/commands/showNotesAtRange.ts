import * as vscode from 'vscode';
import * as path from 'path';
import { NotesManager } from '../core/notesManager';
import { GitUtils } from '../core/gitUtils';
import { NotePanel } from '../ui/notePanel';
import { CodeNote } from '../types';
import { getExtensionContext } from '../extension';

export async function showNotesAtRangeCommand(
	filePath: string,
	startLine: number,
	endLine: number,
	context: vscode.ExtensionContext,
	highlighter: any,
	notesProvider: any
): Promise<void> {
	const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
	if (!workspaceFolder) {
		vscode.window.showErrorMessage('No workspace folder found');
		return;
	}

	let editor = vscode.window.visibleTextEditors.find(e => 
		e.document.uri.fsPath === filePath ||
		e.document.uri.fsPath.endsWith(filePath) ||
		filePath.endsWith(e.document.uri.fsPath)
	);

	let normalizedPath: string;
	
	if (path.isAbsolute(filePath)) {
		normalizedPath = path.relative(workspaceFolder.uri.fsPath, filePath);
	} else {
		normalizedPath = filePath;
	}

	const allNotes = await NotesManager.loadNotes(workspaceFolder);
	const notes = allNotes.filter(note => {
		const notePath = path.isAbsolute(note.filePath) 
			? path.relative(workspaceFolder.uri.fsPath, note.filePath)
			: note.filePath;
		return notePath === normalizedPath || note.filePath === filePath || note.filePath === normalizedPath;
	});
	
	const notesAtRange = notes.filter(note => 
		note.range.start === startLine && note.range.end === endLine
	);

	if (notesAtRange.length === 0) {
		vscode.window.showInformationMessage(`No CodeNotes found at lines ${startLine + 1}-${endLine + 1}. Found ${notes.length} notes in file but none match range.`);
		return;
	}

	if (!editor) {
		const fullPath = path.isAbsolute(normalizedPath) 
			? normalizedPath 
			: path.join(workspaceFolder.uri.fsPath, normalizedPath);
		try {
			const document = await vscode.workspace.openTextDocument(fullPath);
			editor = await vscode.window.showTextDocument(document);
		} catch (error) {
			console.error('Failed to open document:', error);
		}
	}

	if (editor) {
		const maxLine = Math.min(endLine, editor.document.lineCount - 1);
		const range = new vscode.Range(
			startLine,
			0,
			maxLine,
			editor.document.lineAt(maxLine).text.length
		);
		editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
		editor.selection = new vscode.Selection(startLine, 0, maxLine, 0);
	}

	const author = await GitUtils.getAuthorInfo(context);

	NotePanel.show(
		notesAtRange,
		async (note: CodeNote) => {
			const newText = await vscode.window.showInputBox({
				prompt: 'Edit CodeNote',
				value: note.noteText,
				ignoreFocusOut: true,
				validateInput: (value) => {
					return value.trim() ? null : 'CodeNote cannot be empty';
				}
			});

			if (newText && newText !== note.noteText) {
				await NotesManager.updateNote(workspaceFolder, note.id, newText);
				notesProvider?.refresh();
				await highlighter?.refreshAllEditors();
				
				const allUpdatedNotes = await NotesManager.loadNotes(workspaceFolder);
				const updatedNotes = allUpdatedNotes.filter((n: CodeNote) => {
					const notePath = path.isAbsolute(n.filePath) 
						? path.relative(workspaceFolder.uri.fsPath, n.filePath)
						: n.filePath;
					return notePath === normalizedPath || n.filePath === filePath || n.filePath === normalizedPath;
				});
				const updatedNotesAtRange = updatedNotes.filter((n: CodeNote) => 
					n.range.start === startLine && n.range.end === endLine
				);
				NotePanel.show(
					updatedNotesAtRange,
					async (n: CodeNote) => {},
					async (n: CodeNote) => {},
					author.name,
					author.email
				);
				
				vscode.window.showInformationMessage('✏️ CodeNote updated');
			}
		},
		async (note: CodeNote) => {
			const confirm = await vscode.window.showWarningMessage(
				`Delete CodeNote: "${note.noteText}"?`,
				{ modal: true },
				'Delete'
			);

			if (confirm === 'Delete') {
				await NotesManager.deleteNote(workspaceFolder, note.id);
				notesProvider?.refresh();
				await highlighter?.refreshAllEditors();
				
				const allUpdatedNotes = await NotesManager.loadNotes(workspaceFolder);
				const updatedNotes = allUpdatedNotes.filter((n: CodeNote) => {
					const notePath = path.isAbsolute(n.filePath) 
						? path.relative(workspaceFolder.uri.fsPath, n.filePath)
						: n.filePath;
					return notePath === normalizedPath || n.filePath === filePath || n.filePath === normalizedPath;
				});
				const updatedNotesAtRange = updatedNotes.filter((n: CodeNote) => 
					n.range.start === startLine && n.range.end === endLine
				);
				
				if (updatedNotesAtRange.length > 0) {
					NotePanel.show(
						updatedNotesAtRange,
						async (n: CodeNote) => {},
						async (n: CodeNote) => {},
						author.name,
						author.email
					);
				}
				
				vscode.window.showInformationMessage('🗑️ CodeNote deleted');
			}
		},
		author.name,
		author.email
	);
}


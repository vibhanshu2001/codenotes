import * as vscode from 'vscode';
import * as path from 'path';
import { CodeNote } from '../types';
import { NotesManager } from '../core/notesManager';
import { GitUtils } from '../core/gitUtils';
import { NotePanel } from '../ui/notePanel';
import { getExtensionContext } from '../extension';

export async function openNoteInPanelCommand(
	note: CodeNote,
	workspaceFolder: vscode.WorkspaceFolder,
	highlighter: any,
	notesProvider: any
): Promise<void> {
	let fileUri: vscode.Uri;
	
	if (path.isAbsolute(note.filePath)) {
		fileUri = vscode.Uri.file(note.filePath);
	} else {
		fileUri = vscode.Uri.joinPath(workspaceFolder.uri, note.filePath);
	}

	const notes = await NotesManager.getNotesForFile(workspaceFolder, fileUri.fsPath);
	const notesAtRange = notes.filter(n => 
		n.range.start === note.range.start && 
		n.range.end === note.range.end
	);

	if (notesAtRange.length === 0) {
		vscode.window.showInformationMessage('No CodeNotes found at this location');
		return;
	}

	let editor = vscode.window.visibleTextEditors.find(e => 
		e.document.uri.fsPath === fileUri.fsPath || 
		e.document.uri.fsPath === note.filePath ||
		e.document.uri.fsPath.endsWith(note.filePath) ||
		note.filePath === path.relative(workspaceFolder.uri.fsPath, e.document.uri.fsPath)
	);

	if (!editor) {
		try {
			const document = await vscode.workspace.openTextDocument(fileUri);
			editor = await vscode.window.showTextDocument(document, vscode.ViewColumn.One);
		} catch (error) {
			vscode.window.showErrorMessage(`Failed to open file: ${note.filePath}`);
			console.error('Failed to open file:', error);
			return;
		}
	} else {
		await vscode.window.showTextDocument(editor.document, editor.viewColumn);
	}

	if (editor) {
		const maxLine = Math.min(note.range.end, editor.document.lineCount - 1);
		const range = new vscode.Range(
			note.range.start,
			0,
			maxLine,
			editor.document.lineAt(maxLine).text.length
		);
		editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
		editor.selection = new vscode.Selection(note.range.start, 0, maxLine, 0);
	}

	const author = await GitUtils.getAuthorInfo(getExtensionContext());

	NotePanel.show(
		notesAtRange,
		async (n: CodeNote) => {
			const newText = await vscode.window.showInputBox({
				prompt: 'Edit CodeNote',
				value: n.noteText,
				ignoreFocusOut: true,
				validateInput: (value) => {
					return value.trim() ? null : 'CodeNote cannot be empty';
				}
			});

			if (newText && newText !== n.noteText) {
				await NotesManager.updateNote(workspaceFolder, n.id, newText);
				notesProvider?.refresh();
				await highlighter?.refreshAllEditors();
				
				const updatedNotes = await NotesManager.getNotesForFile(workspaceFolder, fileUri.fsPath);
				const updatedNotesAtRange = updatedNotes.filter((updated: CodeNote) => 
					updated.range.start === n.range.start && 
					updated.range.end === n.range.end
				);
				NotePanel.show(
					updatedNotesAtRange,
					async (updatedNote: CodeNote) => {},
					async (updatedNote: CodeNote) => {},
					author.name,
					author.email
				);
				
				vscode.window.showInformationMessage('✏️ CodeNote updated');
			}
		},
		async (n: CodeNote) => {
			const confirm = await vscode.window.showWarningMessage(
				`Delete CodeNote: "${n.noteText}"?`,
				{ modal: true },
				'Delete'
			);

			if (confirm === 'Delete') {
				await NotesManager.deleteNote(workspaceFolder, n.id);
				notesProvider?.refresh();
				await highlighter?.refreshAllEditors();
				
				const updatedNotes = await NotesManager.getNotesForFile(workspaceFolder, fileUri.fsPath);
				const updatedNotesAtRange = updatedNotes.filter((updated: CodeNote) => 
					updated.range.start === n.range.start && 
					updated.range.end === n.range.end
				);
				
				if (updatedNotesAtRange.length > 0) {
					NotePanel.show(
						updatedNotesAtRange,
						async (updatedNote: CodeNote) => {},
						async (updatedNote: CodeNote) => {},
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


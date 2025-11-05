import * as vscode from 'vscode';
import { NotesManager } from '../core/notesManager';
import { GitUtils } from '../core/gitUtils';
import { NotePanel } from '../ui/notePanel';
import { CodeNote } from '../types';

export async function showNotesAtCursor(
	context: vscode.ExtensionContext,
	highlighter: any,
	notesProvider: any
): Promise<void> {
	const editor = vscode.window.activeTextEditor;
	if (!editor) {
		return;
	}

	const workspaceFolder = vscode.workspace.getWorkspaceFolder(editor.document.uri);
	if (!workspaceFolder) {
		return;
	}

	const position = editor.selection.active.line;
	const filePath = editor.document.uri.fsPath;
	const notes = await NotesManager.getNotesForFile(workspaceFolder, filePath);
	
	const notesAtCursor = notes.filter(note => 
		position >= note.range.start && position <= note.range.end
	);

	if (notesAtCursor.length === 0) {
		vscode.window.showInformationMessage('No CodeNotes found at cursor position');
		return;
	}

	const author = await GitUtils.getAuthorInfo(context);

	NotePanel.show(
		notesAtCursor,
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
				
				const updatedNotes = await NotesManager.getNotesForFile(workspaceFolder, filePath);
				const updatedNotesAtCursor = updatedNotes.filter((n: CodeNote) => 
					position >= n.range.start && position <= n.range.end
				);
				NotePanel.show(
					updatedNotesAtCursor,
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
				
				const updatedNotes = await NotesManager.getNotesForFile(workspaceFolder, filePath);
				const updatedNotesAtCursor = updatedNotes.filter((n: CodeNote) => 
					position >= n.range.start && position <= n.range.end
				);
				
				if (updatedNotesAtCursor.length > 0) {
					NotePanel.show(
						updatedNotesAtCursor,
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

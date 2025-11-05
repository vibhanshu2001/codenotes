import * as vscode from 'vscode';
import { CodeNote } from '../types';
import { NotesManager } from '../core/notesManager';
import { GitUtils } from '../core/gitUtils';
import { getExtensionContext } from '../extension';

export async function deleteNoteCommand(
	item: any,
	highlighter: any,
	notesProvider: any
): Promise<void> {
	const note: CodeNote = item.note;
	const workspaceFolder: vscode.WorkspaceFolder = item.workspaceFolder;

	const currentAuthor = await GitUtils.getAuthorInfo(getExtensionContext());
	
	if (note.authorEmail !== currentAuthor.email && note.authorName !== currentAuthor.name) {
		vscode.window.showWarningMessage(`You can only delete your own CodeNotes. This CodeNote was created by ${note.authorName}.`);
		return;
	}

	const confirm = await vscode.window.showWarningMessage(
		`Delete CodeNote: "${note.noteText}"?`,
		{ modal: true },
		'Delete'
	);

	if (confirm === 'Delete') {
		await NotesManager.deleteNote(workspaceFolder, note.id);
		notesProvider?.refresh();
		await highlighter?.refreshAllEditors();
		vscode.window.showInformationMessage('🗑️ CodeNote deleted');
	}
}



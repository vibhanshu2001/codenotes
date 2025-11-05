import * as vscode from 'vscode';
import { CodeNote } from '../types';
import { NotesManager } from '../core/notesManager';
import { GitUtils } from '../core/gitUtils';
import { getExtensionContext } from '../extension';

export async function editNoteCommand(
	item: any,
	highlighter: any,
	notesProvider: any
): Promise<void> {
	const note: CodeNote = item.note;
	const workspaceFolder: vscode.WorkspaceFolder = item.workspaceFolder;

	const currentAuthor = await GitUtils.getAuthorInfo(getExtensionContext());
	
	if (note.authorEmail !== currentAuthor.email && note.authorName !== currentAuthor.name) {
		vscode.window.showWarningMessage(`You can only edit your own CodeNotes. This CodeNote was created by ${note.authorName}.`);
		return;
	}

	const newText = await vscode.window.showInputBox({
		prompt: 'Edit CodeNote',
		value: note.noteText,
		ignoreFocusOut: true
	});

	if (newText && newText !== note.noteText) {
		await NotesManager.updateNote(workspaceFolder, note.id, newText);
		notesProvider?.refresh();
		await highlighter?.refreshAllEditors();
		vscode.window.showInformationMessage('✏️ CodeNote updated');
	}
}



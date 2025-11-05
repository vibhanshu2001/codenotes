import * as vscode from 'vscode';
import * as path from 'path';
import { CodeNote } from '../types';

export async function revealNoteCommand(
	note: CodeNote,
	workspaceFolder?: vscode.WorkspaceFolder
): Promise<void> {
	// Get workspace folder if not provided
	if (!workspaceFolder) {
		const workspaceFolders = vscode.workspace.workspaceFolders;
		if (!workspaceFolders || workspaceFolders.length === 0) {
			vscode.window.showErrorMessage('No workspace folder open');
			return;
		}
		workspaceFolder = workspaceFolders[0];
	}

	// Ensure we have a valid workspace folder
	if (!workspaceFolder || !workspaceFolder.uri || !workspaceFolder.uri.fsPath) {
		vscode.window.showErrorMessage('Invalid workspace folder');
		return;
	}

	// Construct full file path
	let fullPath: vscode.Uri;
	if (path.isAbsolute(note.filePath)) {
		fullPath = vscode.Uri.file(note.filePath);
	} else {
		const joinedPath = path.join(workspaceFolder.uri.fsPath, note.filePath);
		fullPath = vscode.Uri.file(joinedPath);
	}
	
	try {
		const document = await vscode.workspace.openTextDocument(fullPath);
		const editor = await vscode.window.showTextDocument(document);

		const startPos = new vscode.Position(note.range.start, 0);
		const endPos = editor.document.lineAt(Math.min(note.range.end, editor.document.lineCount - 1)).range.end;
		
		const range = new vscode.Range(startPos, endPos);
		editor.selection = new vscode.Selection(startPos, endPos);
		editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
	} catch (error) {
		vscode.window.showErrorMessage(`Failed to open file: ${note.filePath} - ${error}`);
	}
}

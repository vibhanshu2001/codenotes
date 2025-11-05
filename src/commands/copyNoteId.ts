import * as vscode from 'vscode';
import { CodeNote } from '../types';

export async function copyNoteIdCommand(item: any): Promise<void> {
	const note: CodeNote = item.note;

	await vscode.env.clipboard.writeText(note.id);
	vscode.window.showInformationMessage(`📋 CodeNote ID copied: ${note.id.substring(0, 8)}...`);
}


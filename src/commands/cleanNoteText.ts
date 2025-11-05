import * as vscode from 'vscode';
import { NotesManager } from '../core/notesManager';

export async function cleanAllNotesCommand(): Promise<void> {
	const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
	if (!workspaceFolder) {
		vscode.window.showErrorMessage('No workspace folder found');
		return;
	}

	const notes = await NotesManager.loadNotes(workspaceFolder);
	let cleanedCount = 0;

	for (const note of notes) {
		const originalText = note.noteText;
		
		let cleanedText = originalText
			.replace(/#4A90E2; font-weight: 600;">@/g, '@')
			.replace(/<span style="color: #4A90E2; font-weight: 600;">@/g, '@')
			.replace(/<\/span>/g, '')
			.replace(/&lt;/g, '<')
			.replace(/&gt;/g, '>')
			.replace(/&quot;/g, '"')
			.replace(/&#039;/g, "'")
			.replace(/&amp;/g, '&');

		if (cleanedText !== originalText) {
			note.noteText = cleanedText;
			
			const { parseMentions } = require('../utils/textUtils');
			note.mentions = parseMentions(cleanedText);
			
			cleanedCount++;
		}
	}

	if (cleanedCount > 0) {
		await NotesManager.saveNotes(workspaceFolder, notes);
		vscode.window.showInformationMessage(`✨ Cleaned ${cleanedCount} CodeNote(s) with corrupted text`);
	} else {
		vscode.window.showInformationMessage('No corrupted CodeNotes found');
	}
}


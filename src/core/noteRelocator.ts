import * as vscode from 'vscode';
import * as fs from 'fs';
import { CodeNote } from '../types';
import { HashUtils } from '../utils/hashUtils';
import { ASTParser } from '../utils/astParser';
import { NotesManager } from './notesManager';

export class NoteRelocator {
	static async relocateNotes(workspaceFolder: vscode.WorkspaceFolder, filePath: string): Promise<void> {
		const notes = await NotesManager.getNotesForFile(workspaceFolder, filePath);
		
		if (notes.length === 0) {
			return;
		}

		let modified = false;
		const fileContent = fs.readFileSync(filePath, 'utf-8');
		const lines = fileContent.split('\n');

		for (const note of notes) {
			const currentHash = HashUtils.hashAroundLine(lines, note.range.start);
			
			if (currentHash === note.codeHash) {
				continue;
			}

			const newLine = HashUtils.findMatchingLine(lines, note.codeHash, note.range.start, 10);
			
			if (newLine !== null && newLine !== note.range.start) {
				const offset = newLine - note.range.start;
				note.range.start = newLine;
				note.range.end = note.range.end + offset;
				modified = true;
				continue;
			}

			if (note.functionName) {
				const functionLine = ASTParser.findFunctionByName(filePath, note.functionName);
				if (functionLine !== null) {
					const offset = functionLine - note.range.start;
					note.range.start = functionLine;
					note.range.end = note.range.end + offset;
					note.codeHash = HashUtils.hashAroundLine(lines, functionLine);
					modified = true;
					continue;
				}
			}
		}

		if (modified) {
			const allNotes = await NotesManager.loadNotes(workspaceFolder);
			await NotesManager.saveNotes(workspaceFolder, allNotes);
		}
	}
}


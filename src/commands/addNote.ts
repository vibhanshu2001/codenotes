import * as vscode from 'vscode';
import { randomBytes } from 'crypto';
import { CodeNote } from '../types';
import { parseMentions } from '../utils/textUtils';
import { NotesManager } from '../core/notesManager';
import { GitUtils } from '../core/gitUtils';
import { HashUtils } from '../utils/hashUtils';
import { ASTParser } from '../utils/astParser';

export async function addNoteCommand(
	context: vscode.ExtensionContext,
	highlighter: any,
	notesProvider: any
): Promise<void> {
	const editor = vscode.window.activeTextEditor;
	if (!editor) {
		vscode.window.showErrorMessage('No active editor');
		return;
	}

	const workspaceFolder = vscode.workspace.getWorkspaceFolder(editor.document.uri);
	if (!workspaceFolder) {
		vscode.window.showErrorMessage('File must be in workspace');
		return;
	}

	const selection = editor.selection;
	const startLine = selection.start.line;
	const endLine = selection.end.line;

	const author = await GitUtils.getAuthorInfo(context);
	const filePath = editor.document.uri.fsPath;
	const relativePath = vscode.workspace.asRelativePath(filePath);

	const existingNotes = await NotesManager.getNotesForFile(workspaceFolder, filePath);
	const duplicateNote = existingNotes.find(note => 
		note.range.start === startLine && 
		note.range.end === endLine && 
		note.authorName === author.name
	);

	if (duplicateNote) {
		const action = await vscode.window.showWarningMessage(
			`You already have a CodeNote on line${startLine !== endLine ? 's' : ''} ${startLine + 1}${startLine !== endLine ? `-${endLine + 1}` : ''}`,
			'Edit Existing',
			'Add Another',
			'Cancel'
		);

		if (action === 'Cancel' || !action) {
			return;
		}
		
		if (action === 'Edit Existing') {
			const newText = await showInlineNoteInput(editor, startLine, endLine, duplicateNote.noteText);
			if (newText && newText !== duplicateNote.noteText) {
				await NotesManager.updateNote(workspaceFolder, duplicateNote.id, newText);
				notesProvider?.refresh();
				await highlighter?.refreshAllEditors();
				vscode.window.showInformationMessage('✏️ CodeNote updated');
			}
			return;
		}
	}

	const noteText = await showInlineNoteInput(editor, startLine, endLine);

	if (!noteText) {
		return;
	}

	const fileContent = editor.document.getText();
	const lines = fileContent.split('\n');

	const codeHash = HashUtils.hashAroundLine(lines, startLine);
	const contentHash = HashUtils.hashLineRange(lines, startLine, endLine);
	const functionName = ASTParser.getFunctionNameAtLine(filePath, startLine + 1);
	
	// Get git context
	const gitContext = GitUtils.getGitContext(workspaceFolder.uri.fsPath);
	
	// Parse mentions
	const mentions = parseMentions(noteText);

	const note: CodeNote = {
		id: randomBytes(8).toString('hex'),
		filePath: relativePath,
		functionName,
		codeHash,
		range: { start: startLine, end: endLine },
		noteText,
		authorName: author.name,
		authorEmail: author.email,
		timestamp: new Date().toISOString(),
		contentHash,
		gitBranch: gitContext.branch,
		gitCommit: gitContext.commit,
		mentions,
		isOutdated: false
	};

	await NotesManager.addNote(workspaceFolder, note);
	notesProvider?.refresh();
	await highlighter?.updateDecorations(editor);

	const rangeStr = startLine === endLine ? `line ${startLine + 1}` : `lines ${startLine + 1}-${endLine + 1}`;
		vscode.window.showInformationMessage(`✅ CodeNote added at ${rangeStr}`);
}

async function showInlineNoteInput(editor: vscode.TextEditor, startLine: number, endLine: number, defaultValue?: string): Promise<string | undefined> {
	const rangeStr = startLine === endLine 
		? `line ${startLine + 1}` 
		: `lines ${startLine + 1}-${endLine + 1}`;

	return await vscode.window.showInputBox({
		prompt: `Add CodeNote for ${rangeStr}`,
		placeHolder: 'Enter your CodeNote...',
		value: defaultValue,
		ignoreFocusOut: true,
		validateInput: (value) => {
			return value.trim() ? null : 'CodeNote cannot be empty';
		}
	});
}

export async function editNoteAtCursor(
	context: vscode.ExtensionContext,
	highlighter: any,
	notesProvider: any
): Promise<void> {
	const editor = vscode.window.activeTextEditor;
	if (!editor) {
		vscode.window.showErrorMessage('No active editor');
		return;
	}

	const workspaceFolder = vscode.workspace.getWorkspaceFolder(editor.document.uri);
	if (!workspaceFolder) {
		return;
	}

	const position = editor.selection.active.line;
	const filePath = editor.document.uri.fsPath;
	const notes = await NotesManager.getNotesForFile(workspaceFolder, filePath);
	
	const author = await GitUtils.getAuthorInfo(context);
	const noteAtCursor = notes.find(note => 
		position >= note.range.start && 
		position <= note.range.end &&
		note.authorName === author.name
	);

	if (!noteAtCursor) {
		vscode.window.showInformationMessage('No CodeNote found at cursor position by you');
		return;
	}

	const newText = await showInlineNoteInput(editor, noteAtCursor.range.start, noteAtCursor.range.end, noteAtCursor.noteText);
	
	if (newText && newText !== noteAtCursor.noteText) {
		await NotesManager.updateNote(workspaceFolder, noteAtCursor.id, newText);
		notesProvider?.refresh();
		await highlighter?.refreshAllEditors();
		vscode.window.showInformationMessage('✏️ CodeNote updated');
	}
}

export async function deleteNoteAtCursor(
	context: vscode.ExtensionContext,
	highlighter: any,
	notesProvider: any
): Promise<void> {
	const editor = vscode.window.activeTextEditor;
	if (!editor) {
		vscode.window.showErrorMessage('No active editor');
		return;
	}

	const workspaceFolder = vscode.workspace.getWorkspaceFolder(editor.document.uri);
	if (!workspaceFolder) {
		return;
	}

	const position = editor.selection.active.line;
	const filePath = editor.document.uri.fsPath;
	const notes = await NotesManager.getNotesForFile(workspaceFolder, filePath);
	
	const author = await GitUtils.getAuthorInfo(context);
	const noteAtCursor = notes.find(note => 
		position >= note.range.start && 
		position <= note.range.end &&
		note.authorName === author.name
	);

	if (!noteAtCursor) {
		vscode.window.showInformationMessage('No CodeNote found at cursor position by you');
		return;
	}

	const confirm = await vscode.window.showWarningMessage(
		`Delete CodeNote: "${noteAtCursor.noteText}"?`,
		{ modal: true },
		'Delete'
	);

	if (confirm === 'Delete') {
		await NotesManager.deleteNote(workspaceFolder, noteAtCursor.id);
		notesProvider?.refresh();
		await highlighter?.refreshAllEditors();
		vscode.window.showInformationMessage('🗑️ CodeNote deleted');
	}
}

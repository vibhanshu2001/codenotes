import * as vscode from 'vscode';
import { SidebarView } from './ui/sidebarView';
import { HoverView } from './ui/hoverView';
import { NoteRelocator, FileWatcher } from './core';
import { NotesManager, GitUtils } from './core';
import { addNoteCommand, editNoteAtCursor, deleteNoteAtCursor } from './commands/addNote';
import { editNoteCommand } from './commands/editNote';
import { deleteNoteCommand } from './commands/deleteNote';
import { revealNoteCommand } from './commands/revealNote';
import { showNotesAtCursor } from './commands/showNotes';
import { showNotesAtRangeCommand } from './commands/showNotesAtRange';
import { copyNoteIdCommand } from './commands/copyNoteId';
import { cleanAllNotesCommand } from './commands/cleanNoteText';
import { openNoteInPanelCommand } from './commands/openNoteInPanel';
import { FloatingToolbar } from './ui/floatingToolbar';

let notesProvider: SidebarView | undefined;
let highlighter: HoverView | undefined;
let extensionContext: vscode.ExtensionContext;

export function getExtensionContext(): vscode.ExtensionContext {
	return extensionContext;
}

export function activate(context: vscode.ExtensionContext) {
	extensionContext = context;
	console.log('CodeNotes extension is now active!');

	try {
		const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
		
		if (workspaceFolder) {
			notesProvider = new SidebarView(workspaceFolder);
			highlighter = new HoverView();

			const treeView = vscode.window.createTreeView('codenotesView', {
				treeDataProvider: notesProvider,
				showCollapseAll: true
			});

			context.subscriptions.push(treeView);
		}

		const addNote = vscode.commands.registerCommand('codenotes.addNote', async () => {
			await addNoteCommand(context, highlighter, notesProvider);
		});

		const editNoteAtCursorCmd = vscode.commands.registerCommand('codenotes.editNoteAtCursor', async () => {
			await editNoteAtCursor(context, highlighter, notesProvider);
		});

		const deleteNoteAtCursorCmd = vscode.commands.registerCommand('codenotes.deleteNoteAtCursor', async () => {
			await deleteNoteAtCursor(context, highlighter, notesProvider);
		});

		const revealNote = vscode.commands.registerCommand('codenotes.revealNote', async (note, workspaceFolder) => {
			await revealNoteCommand(note, workspaceFolder);
		});

		const deleteNote = vscode.commands.registerCommand('codenotes.deleteNote', async (item) => {
			await deleteNoteCommand(item, highlighter, notesProvider);
		});

		const editNote = vscode.commands.registerCommand('codenotes.editNote', async (item) => {
			await editNoteCommand(item, highlighter, notesProvider);
		});

		const showNotes = vscode.commands.registerCommand('codenotes.showNotes', async () => {
			await showNotesAtCursor(context, highlighter, notesProvider);
		});

		const showNotesAtRange = vscode.commands.registerCommand('codenotes.showNotesAtRange', async (...args: any[]) => {
			if (args.length === 3 && typeof args[0] === 'string' && typeof args[1] === 'number' && typeof args[2] === 'number') {
				await showNotesAtRangeCommand(args[0], args[1], args[2], context, highlighter, notesProvider);
			} else if (args.length === 1 && typeof args[0] === 'string') {
				const decoded = decodeURIComponent(args[0]);
				
				if (decoded.includes(':')) {
					const hoverContext = HoverView.hoverContext?.get(decoded);
					if (hoverContext) {
						await showNotesAtRangeCommand(hoverContext.filePath, hoverContext.startLine, hoverContext.endLine, context, highlighter, notesProvider);
						return;
					}
				}
				
				if (decoded.includes('|')) {
					const parts = decoded.split('|');
					if (parts.length === 3) {
						const filePath = parts[0];
						const startLine = parseInt(parts[1]);
						const endLine = parseInt(parts[2]);
						if (!isNaN(startLine) && !isNaN(endLine)) {
							await showNotesAtRangeCommand(filePath, startLine, endLine, context, highlighter, notesProvider);
							return;
						}
					}
				}
			}
			await showNotesAtCursor(context, highlighter, notesProvider);
		});

		const copyNoteId = vscode.commands.registerCommand('codenotes.copyNoteId', async (item) => {
			await copyNoteIdCommand(item);
		});

		const cleanNotes = vscode.commands.registerCommand('codenotes.cleanNotes', async () => {
			await cleanAllNotesCommand();
			notesProvider?.refresh();
			highlighter?.refreshAllEditors();
		});

		const refreshCommand = vscode.commands.registerCommand('codenotes.refresh', () => {
			notesProvider?.refresh();
			highlighter?.refreshAllEditors();
		});

		const openNoteInPanel = vscode.commands.registerCommand('codenotes.openNoteInPanel', async (note, workspaceFolder) => {
			await openNoteInPanelCommand(note, workspaceFolder, highlighter, notesProvider);
		});

		context.subscriptions.push(
			addNote,
			editNoteAtCursorCmd,
			deleteNoteAtCursorCmd,
			revealNote,
			deleteNote,
			editNote,
			showNotes,
			showNotesAtRange,
			copyNoteId,
			cleanNotes,
			refreshCommand,
			openNoteInPanel
		);

		// Initialize floating toolbar (code lens)
		FloatingToolbar.initialize(async () => {
			await addNoteCommand(context, highlighter, notesProvider);
		});

		if (highlighter) {
			// Clear toolbar when editor changes
			vscode.window.onDidChangeActiveTextEditor(editor => {
				if (editor) {
					highlighter?.updateDecorations(editor);
				}
				FloatingToolbar.clear();
			}, null, context.subscriptions);

			// Update toolbar based on selection
			vscode.window.onDidChangeTextEditorSelection(event => {
				const editor = event.textEditor;
				const selection = event.selections[0];
				
				if (selection && !selection.isEmpty) {
					FloatingToolbar.updateSelection(editor, selection);
				} else {
					FloatingToolbar.clear();
				}
			}, null, context.subscriptions);

			// Clear toolbar when text changes
			vscode.workspace.onDidChangeTextDocument(event => {
				const editor = vscode.window.activeTextEditor;
				if (editor && event.document === editor.document) {
					highlighter?.updateDecorations(editor);
					FloatingToolbar.clear();
				}
			}, null, context.subscriptions);

		vscode.workspace.onDidSaveTextDocument(async document => {
			const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
			if (workspaceFolder) {
				// Check for outdated notes
				await NotesManager.checkAndMarkOutdated(workspaceFolder, document.uri.fsPath, document);
				
				await NoteRelocator.relocateNotes(workspaceFolder, document.uri.fsPath);
				notesProvider?.refresh();
				const editor = vscode.window.activeTextEditor;
				if (editor && editor.document === document) {
					await highlighter?.updateDecorations(editor);
				}
			}
		}, null, context.subscriptions);

			if (vscode.window.activeTextEditor) {
				highlighter.updateDecorations(vscode.window.activeTextEditor);
			}
		}

		console.log('CodeNotes: All commands registered successfully');
		
	} catch (error) {
		console.error('CodeNotes activation error:', error);
		vscode.window.showErrorMessage(`CodeNotes failed to activate: ${error}`);
	}
}

export function deactivate() {
	highlighter?.dispose();
	FloatingToolbar.dispose();
	NotesManager.clearCache();
	GitUtils.clearCache();
	console.log('CodeNotes extension deactivated');
}

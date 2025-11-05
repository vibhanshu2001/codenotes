import * as vscode from 'vscode';
import { NotesManager } from './notesManager';
import { NoteRelocator } from './noteRelocator';

export class FileWatcher {
	private disposables: vscode.Disposable[] = [];

	constructor(
		private onNotesChanged: () => void,
		private onHighlightsChanged: () => void
	) {}

	initialize(context: vscode.ExtensionContext): void {
		const onDidSaveTextDocument = vscode.workspace.onDidSaveTextDocument(async (document) => {
			const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
			if (workspaceFolder) {
				await NotesManager.checkAndMarkOutdated(workspaceFolder, document.uri.fsPath, document);
				await NoteRelocator.relocateNotes(workspaceFolder, document.uri.fsPath);
				this.onNotesChanged();
				this.onHighlightsChanged();
			}
		});

		context.subscriptions.push(onDidSaveTextDocument);
		this.disposables.push(onDidSaveTextDocument);
	}

	dispose(): void {
		this.disposables.forEach(d => d.dispose());
		this.disposables = [];
	}
}


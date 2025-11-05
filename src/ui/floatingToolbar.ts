import * as vscode from 'vscode';

export class FloatingToolbar implements vscode.CodeLensProvider {
	private static instance: FloatingToolbar | undefined;
	private static currentSelection: vscode.Selection | undefined;
	private static currentEditor: vscode.TextEditor | undefined;
	private static codeLensDisposable: vscode.Disposable | undefined;
	private _onDidChangeCodeLenses = new vscode.EventEmitter<void>();
	readonly onDidChangeCodeLenses = this._onDidChangeCodeLenses.event;

	private constructor(
		private onAddNote: () => Promise<void>
	) {}

	public static initialize(onAddNote: () => Promise<void>): void {
		if (!this.instance) {
			this.instance = new FloatingToolbar(onAddNote);
			this.codeLensDisposable = vscode.languages.registerCodeLensProvider(
				{ pattern: '**/*' },
				this.instance
			);
		}
	}

	public static updateSelection(editor: vscode.TextEditor, selection: vscode.Selection): void {
		if (!this.instance) {
			return;
		}

		const hasSelection = !selection.isEmpty && 
		                    (selection.end.line > selection.start.line || 
		                     selection.end.character > selection.start.character);

		if (hasSelection) {
			this.currentEditor = editor;
			this.currentSelection = selection;
			this.instance._onDidChangeCodeLenses.fire();
		} else {
			this.clear();
		}
	}

	public static clear(): void {
		if (!this.instance) {
			return;
		}
		
		this.currentEditor = undefined;
		this.currentSelection = undefined;
		this.instance._onDidChangeCodeLenses.fire();
	}

	public static dispose(): void {
		if (this.codeLensDisposable) {
			this.codeLensDisposable.dispose();
		}
		this.instance = undefined;
	}

	provideCodeLenses(document: vscode.TextDocument): vscode.CodeLens[] {
		const editor = FloatingToolbar.currentEditor;
		const selection = FloatingToolbar.currentSelection;

		if (!editor || !selection || editor.document !== document) {
			return [];
		}

		const range = new vscode.Range(
			selection.start.line, 
			0, 
			selection.start.line, 
			0
		);

		const codeLens = new vscode.CodeLens(range, {
			title: '$(add) Add CodeNote',
			tooltip: 'Add CodeNote for selected lines',
			command: 'codenotes.addNote',
			arguments: []
		});

		return [codeLens];
	}
}


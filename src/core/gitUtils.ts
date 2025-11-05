import * as vscode from 'vscode';
import { execSync } from 'child_process';
import { AuthorInfo } from '../types';
import { GitContext } from '../types/git';

export class GitUtils {
	private static authorCache: AuthorInfo | null = null;

	static async getAuthorInfo(context: vscode.ExtensionContext): Promise<AuthorInfo> {
		if (this.authorCache) {
			return this.authorCache;
		}

		let name: string | undefined;
		let email: string | null = null;

		try {
			name = execSync('git config user.name', { encoding: 'utf-8' }).trim();
			email = execSync('git config user.email', { encoding: 'utf-8' }).trim();
		} catch (error) {
		}

		if (!name) {
			const storedName = context.globalState.get<string>('codenotes.authorName');
			if (storedName) {
				name = storedName;
				const storedEmail = context.globalState.get<string>('codenotes.authorEmail');
				if (storedEmail) {
					email = storedEmail;
				}
			} else {
				name = await vscode.window.showInputBox({
					prompt: 'Enter your name for CodeNotes',
					placeHolder: 'Your Name',
					ignoreFocusOut: true
				});

				if (!name) {
					name = 'Anonymous';
				}

				await context.globalState.update('codenotes.authorName', name);

				const emailInput = await vscode.window.showInputBox({
					prompt: 'Enter your email (optional)',
					placeHolder: 'your.email@example.com',
					ignoreFocusOut: true
				});

				if (emailInput) {
					email = emailInput;
					await context.globalState.update('codenotes.authorEmail', emailInput);
				}
			}
		}

		this.authorCache = { name: name || 'Anonymous', email };
		return this.authorCache;
	}

	static getGitBranch(workspacePath: string): string | undefined {
		try {
			return execSync('git rev-parse --abbrev-ref HEAD', {
				cwd: workspacePath,
				encoding: 'utf-8'
			}).trim();
		} catch (error) {
			return undefined;
		}
	}

	static getGitCommit(workspacePath: string): string | undefined {
		try {
			return execSync('git rev-parse --short HEAD', {
				cwd: workspacePath,
				encoding: 'utf-8'
			}).trim();
		} catch (error) {
			return undefined;
		}
	}

	static getGitContext(workspacePath: string): GitContext {
		return {
			branch: this.getGitBranch(workspacePath),
			commit: this.getGitCommit(workspacePath)
		};
	}

	static clearCache(): void {
		this.authorCache = null;
	}
}


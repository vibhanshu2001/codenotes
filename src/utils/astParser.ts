import { parse } from '@typescript-eslint/typescript-estree';
import * as fs from 'fs';

export class ASTParser {
	static getFunctionNameAtLine(filePath: string, lineNumber: number): string | null {
		try {
			const content = fs.readFileSync(filePath, 'utf-8');
			
			if (!filePath.match(/\.(ts|tsx|js|jsx)$/)) {
				return null;
			}

			const ast = parse(content, {
				loc: true,
				range: true,
				comment: false,
				jsx: filePath.endsWith('x')
			});

			let enclosingFunction: string | null = null;

			const traverse = (node: any, depth: number = 0): void => {
				if (!node || !node.loc) {
					return;
				}

				const nodeStart = node.loc.start.line;
				const nodeEnd = node.loc.end.line;

				if (lineNumber >= nodeStart && lineNumber <= nodeEnd) {
					if (node.type === 'FunctionDeclaration' && node.id && node.id.name) {
						enclosingFunction = node.id.name;
					} else if (node.type === 'MethodDefinition' && node.key && node.key.name) {
						enclosingFunction = node.key.name;
					} else if (node.type === 'ArrowFunctionExpression' || node.type === 'FunctionExpression') {
						if (node.parent && node.parent.type === 'VariableDeclarator' && node.parent.id) {
							enclosingFunction = node.parent.id.name;
						}
					} else if (node.type === 'ClassDeclaration' && node.id && node.id.name) {
						enclosingFunction = node.id.name;
					}

					for (const key in node) {
						if (key !== 'parent' && typeof node[key] === 'object') {
							if (Array.isArray(node[key])) {
								node[key].forEach((child: any) => {
									if (child && typeof child === 'object') {
										child.parent = node;
										traverse(child, depth + 1);
									}
								});
							} else if (node[key]) {
								node[key].parent = node;
								traverse(node[key], depth + 1);
							}
						}
					}
				}
			};

			traverse(ast);
			return enclosingFunction;
		} catch (error) {
			return null;
		}
	}

	static findFunctionByName(filePath: string, functionName: string): number | null {
		try {
			const content = fs.readFileSync(filePath, 'utf-8');
			
			if (!filePath.match(/\.(ts|tsx|js|jsx)$/)) {
				return null;
			}

			const ast = parse(content, {
				loc: true,
				range: true,
				comment: false,
				jsx: filePath.endsWith('x')
			});

			let foundLine: number | null = null;

			const traverse = (node: any): void => {
				if (!node || !node.loc || foundLine !== null) {
					return;
				}

				if (node.type === 'FunctionDeclaration' && node.id && node.id.name === functionName) {
					foundLine = node.loc.start.line;
					return;
				} else if (node.type === 'MethodDefinition' && node.key && node.key.name === functionName) {
					foundLine = node.loc.start.line;
					return;
				} else if (node.type === 'ClassDeclaration' && node.id && node.id.name === functionName) {
					foundLine = node.loc.start.line;
					return;
				}

				for (const key in node) {
					if (typeof node[key] === 'object') {
						if (Array.isArray(node[key])) {
							node[key].forEach((child: any) => traverse(child));
						} else if (node[key]) {
							traverse(node[key]);
						}
					}
				}
			};

			traverse(ast);
			return foundLine;
		} catch (error) {
			return null;
		}
	}
}

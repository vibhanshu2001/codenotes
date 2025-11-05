export interface NoteRange {
	start: number;
	end: number;
}

export interface CodeNote {
	id: string;
	filePath: string;
	functionName: string | null;
	codeHash: string;
	range: NoteRange;
	noteText: string;
	authorName: string;
	authorEmail: string | null;
	timestamp: string;
	gitBranch?: string;
	gitCommit?: string;
	contentHash: string;
	isOutdated?: boolean;
	mentions?: string[];
}

export interface NotesData {
	notes: CodeNote[];
}


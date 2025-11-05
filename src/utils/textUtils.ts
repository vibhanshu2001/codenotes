export function parseMentions(text: string): string[] {
	const mentionRegex = /@([a-zA-Z0-9_]+)/g;
	const mentions: string[] = [];
	let match;
	while ((match = mentionRegex.exec(text)) !== null) {
		mentions.push(match[1]);
	}
	return [...new Set(mentions)];
}

export function escapeHtml(text: string): string {
	return text
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#039;');
}

export function parseNoteLinks(text: string): string {
	return text.replace(/#([a-zA-Z0-9_]+)/g, '<a href="#" data-note-id="$1" style="color: #4A90E2; text-decoration: underline;">#$1</a>');
}

export function highlightMentionsForDisplay(text: string): string {
	return text.replace(/@([a-zA-Z0-9_]+)/g, '<span style="color: #4A90E2; font-weight: 600;">@$1</span>');
}

export function highlightMentions(text: string): string {
	return escapeHtml(text).replace(/@([a-zA-Z0-9_]+)/g, '<span style="color: #4A90E2; font-weight: 600;">@$1</span>');
}


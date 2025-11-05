export const AUTHOR_COLORS: string[] = [
	'rgba(173, 216, 230, 0.15)',
	'rgba(144, 238, 144, 0.15)',
	'rgba(255, 253, 208, 0.15)',
	'rgba(255, 182, 193, 0.15)',
	'rgba(230, 230, 250, 0.15)',
	'rgba(255, 228, 196, 0.15)',
];

export const AUTHOR_BORDER_COLORS: string[] = [
	'rgba(135, 206, 250, 0.6)',
	'rgba(144, 238, 144, 0.6)',
	'rgba(255, 215, 0, 0.6)',
	'rgba(255, 182, 193, 0.6)',
	'rgba(147, 112, 219, 0.6)',
	'rgba(255, 160, 122, 0.6)',
];

export const AVATAR_COLORS: string[] = [
	'#4A90E2', '#7B68EE', '#50C878', '#FF6B9D', '#FFA500', '#20B2AA'
];

export function getAuthorColorIndex(authorEmail: string | null, authorName?: string): number {
	const textToHash = authorEmail || authorName || 'unknown';
	let hash = 0;
	for (let i = 0; i < textToHash.length; i++) {
		hash = ((hash << 5) - hash) + textToHash.charCodeAt(i);
		hash = hash & hash;
	}
	return Math.abs(hash) % AUTHOR_COLORS.length;
}

export function getAuthorColor(authorEmail: string | null, authorName?: string): string {
	const index = getAuthorColorIndex(authorEmail, authorName);
	return AUTHOR_COLORS[index];
}

export function getAuthorBorderColor(authorEmail: string | null, authorName?: string): string {
	const index = getAuthorColorIndex(authorEmail, authorName);
	return AUTHOR_BORDER_COLORS[index];
}

export function getAvatarColor(authorName: string): string {
	let hash = 0;
	for (let i = 0; i < authorName.length; i++) {
		hash = ((hash << 5) - hash) + authorName.charCodeAt(i);
		hash = hash & hash;
	}
	return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}


# Change Log

All notable changes to the CodeNotes extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.3] - 2025-01-XX

### Added
- Support for VS Code-based editors (Cursor, Windsurf, and other VS Code-compatible editors)
- Installation instructions for editors where extension doesn't appear in search
- Marketplace URL configuration guide for manual setup

### Fixed
- Fixed broken marketplace URL in README (updated to correct extension ID)

### Documentation
- Updated README with supported editors section
- Added troubleshooting guide for extension installation issues
- Updated compatibility section to include VS Code-based editors

## [1.0.2] - 2025-01-XX

### Fixed
- Added screenshot images to extension package for proper display in VS Code Marketplace
- Updated README image references to use relative paths for better reliability

## [1.0.1] - 2025-01-XX

### Fixed
- Added extension icon to package.json for proper display in VS Code Marketplace

## [1.0.0] - 2025-01-XX

### Added
- Initial release of CodeNotes
- Add contextual notes directly in code files
- Multi-author support with automatic Git integration
- Code-aware note relocation that keeps notes attached when code moves
- Inline highlights with soft background colors
- Hover tooltips for quick note preview
- Sidebar view with notes organized by file
- Panel view showing all notes for a code range
- Author color coding for visual distinction
- Mentions support with @username syntax
- Note linking with #noteId syntax
- Diff-aware notes that detect code changes
- Function/class detection for better context
- Git context capture (branch, commit hash)
- Keyboard shortcuts for all major operations
- Right-click context menu integration
- Note ID copying functionality
- Author avatars in sidebar
- Color legend showing all authors
- Outdated note warnings when code has changed

### Features
- One-click note adding with `Ctrl+Shift+N` / `Cmd+Shift+N`
- Edit notes with `Ctrl+Shift+E` / `Cmd+Shift+E`
- Delete notes with `Ctrl+Shift+D` / `Cmd+Shift+D`
- View notes with `Ctrl+Shift+V` / `Cmd+Shift+V`
- Automatic author detection from Git configuration
- Notes stored in `.codenotes` file (JSON format)
- Safe to commit notes to version control
- Works with all file types and languages


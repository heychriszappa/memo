# Changelog

All notable changes to Stik will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.8.0] - 2026-04-13
Voice dictation, clipboard capture, and dev tooling

### Added
- **On-device voice dictation** — new `⌘⇧D` shortcut toggles live Whisper-backed dictation inside the note editor. All transcription runs locally via [WhisperKit](https://github.com/argmaxinc/WhisperKit) on the Neural Engine; audio never leaves your Mac. Models are downloaded on demand and persist across launches
- **Voice note shortcut** — `⌘⇧V` opens a fresh post-it and starts dictating immediately, for frictionless capture-by-voice
- **Dictation setup modal** — first-run picker for language (auto-detect + 20 common languages) and Whisper model tier (`small` ~250 MB for speed, `large-v3 turbo` ~632 MB for accuracy). Choice is persisted, reopens on demand from Settings
- **Dictation settings panel** — new "Dictation" tab under Settings lets you change active model, switch languages, delete downloaded models, and see disk usage
- **Clip capture** — new `⌘⇧C` shortcut grabs the currently-selected text from any app (Safari, Terminal, VS Code, anywhere with a standard text field) via the Accessibility API and appends it to a dedicated "Clips" note. No clipboard round-trip, no flaky keystroke simulation
- **Accessibility permission prompts** — when clip capture is used without Accessibility granted, Stik now opens System Settings → Privacy & Security → Accessibility directly, with session-level dedup so it doesn't re-open on every failed capture

### Fixed
- **iCloud container path broken after macOS iCloud migration** (#60) — Stik now syncs into `~/Library/Mobile Documents/com~apple~CloudDocs/Stik/` (standard iCloud Drive) instead of the legacy `iCloud~com~0xmassi~stik` container path, which had stopped working for new installs
- **Search results couldn't open notes** (#61) — `get_note_content` was rejecting valid paths because it compared raw input against a canonicalized notes root. Both sides now canonicalize before the `starts_with` check, so notes opened from semantic search results load correctly

### Changed
- **DarwinKit sidecar updated to v0.3.0** — adds `dictation.*` method surface and concurrent JSON-RPC request dispatch so slow handlers (e.g. a 30–60 s WhisperKit CoreML compilation) no longer block fast NLP calls
- **Hardened runtime gains `com.apple.security.device.audio-input`** — required for mic access under signed + notarized builds
- **App moved devtools console behind an explicit opt-in** — no longer auto-opens in debug builds, which was noisy while iterating on features that steal focus

### Developer experience
- Local dev now uses a stable code-signing identity (auto-detects `Developer ID Application` in login keychain, or falls back to a self-signed `Stik Local Dev` cert), so TCC grants (Mic, Accessibility) persist across rebuilds instead of needing to be re-granted on every `cargo build`
- Fast incremental rebuild loop (`~20–40 s` vs. `2–3 min` for full bundle) for iterating on TCC/entitlements/signing-dependent features that `tauri dev` can't cover

## [0.7.9] - 2026-03-17
Local file watching and external change detection

### Added
- **Local file watcher** — external changes to `.md` files (from CLI tools, Obsidian, scripts, etc.) are now detected in real-time and reflected in the UI without restarting. Uses `notify-rs` with FSEvents backend and 500ms debouncing
- **Auto-refresh on external changes** — CommandPalette note list, folder stats, and search results now refresh automatically when files change externally, for both local and iCloud modes

### Fixed
- **iCloud sync not refreshing note list** — `SyncIndicator` showed the sync animation but `CommandPalette` never refreshed. Now listens for `icloud-files-changed` events and updates the list

### Dependencies
- Bumped `quinn-proto` 0.11.13 → 0.11.14
- Bumped `undici` 7.21.0 → 7.24.1

## [0.7.8] - 2026-03-11
Hotfix: DarwinKit sidecar not found in production bundle

### Fixed
- **DarwinKit "bridge not started"** — sidecar path resolution looked in `Contents/Resources/binaries/` but Tauri `externalBin` places sidecars in `Contents/MacOS/`. Fixed to check the correct location. Also fixes AI features, semantic search, and folder suggestions being unavailable in release builds
- **CI: wrong DarwinKit binary** — `find` command picked up an arm64-only intermediate build artifact instead of the universal binary. Now uses the deterministic path `.build/apple/Products/Release/darwinkit`

## [0.7.7] - 2026-03-10
Hotfix: remove restricted iCloud entitlements that prevented app launch

### Fixed
- **App fails to open after update** — removed `com.apple.developer.icloud-container-identifiers` and related entitlements from `Entitlements.plist`. These restricted entitlements require a provisioning profile and caused Gatekeeper to block the app. iCloud sync still works via the well-known `~/Library/Mobile Documents/` path

## [0.7.6] - 2026-03-10
Note locking, iCloud sync, and storage abstraction

### Added
- **Note locking** — encrypt notes with AES-256-GCM, protected by Touch ID or device password. Lock/unlock via `⌘L` in command palette. Configurable session timeout (5m, 15m, 30m, 1h, or until quit) and lock-on-sleep option
- **Lock prompt modal** — Touch ID authentication UI with idle/authenticating/failed states when opening locked notes
- **Lock indicators** — lock icon and filename-derived title shown for encrypted notes in command palette and note list
- **Recovery key export** — export the encryption key as base64 from Settings > Privacy for backup purposes
- **iCloud sync** — enable in Settings to store notes in iCloud Drive, synced across all devices via `NSFileCoordinator`-based coordinated file operations
- **Note migration** — one-click migration of existing local notes to iCloud when first enabling sync
- **Sync indicator** — cloud icon in the UI pulses when iCloud sync activity is detected
- **Storage abstraction layer** — all file I/O routed through `StorageMode` (local, iCloud, or custom directory), transparent to the rest of the codebase
- **DarwinKit Auth handler** — biometric / device-password authentication via `LAContext` over JSON-RPC
- **DarwinKit Cloud handler** — 11 coordinated iCloud file operations (read, write, delete, move, copy, list, monitor) with async notification support

### Fixed
- **Window opening off-screen** — `⌘⇧S` no longer opens on a disconnected external monitor; falls back to centering on the primary display
- **Keychain double-prompting** — switched from macOS Keychain to file-based key storage (`~/.stik/note-key`) with one-time Keychain migration to avoid duplicate auth dialogs
- **Locked notes showing "Untitled"** — encrypted notes now derive a readable title from their filename slug instead of showing "Untitled"

## [0.7.5] - 2026-03-04
Editor live preview polish

### Fixed
- **Fenced code block cursor jump** — pressing Enter after typing the closing `` ``` `` fence no longer jumps the cursor back to a previous position. Root cause: CodeMirror 6 silently breaks `ViewPlugin` replace-decorations that cross newline boundaries; fence lines are now collapsed via within-line replace + CSS `height: 0` (SilverBullet pattern)
- **Heading format dropdown clipped** — the H1/H2/H3 dropdown in the formatting toolbar was cut off by `overflow: hidden`; fixed with `overflow-x: clip` which allows the dropdown to escape the container without affecting vertical scroll
- **Fenced code block flash on typing** — typing `` ` `` or `~` at the start of a line no longer causes a one-frame flash where the characters disappear. The incremental parser briefly creates an `InlineCode`/`Strikethrough` node before recognising `FencedCode`; added a guard to skip hiding markers that look like fence delimiters mid-typing
- **Smart Enter/Backspace inside fenced code** — Enter before `~~` and Backspace inside `~~~~` no longer interfere with tilde-fenced code blocks

## [0.7.4] - 2026-03-02
Window position and cursor persistence

### Added
- **Window position persistence** — capture, sticked, and viewing windows now remember their last position across sessions. All three window types share the same position, so Cmd+Shift+S and Cmd+Shift+L always open at the same spot
- **Multi-monitor support** — saved window positions are validated against connected monitors; if the target monitor is unplugged, the window falls back to centering on the primary display
- **Cursor position persistence** — cursor position is saved per-note when closing any window and restored when reopening the same note via Cmd+Shift+L

### Fixed
- **Retina display positioning** — fixed physical/logical coordinate mismatch where `outerPosition()` returned physical pixels but `WebviewWindowBuilder::position()` interpreted them as logical, causing windows to drift off-screen on HiDPI displays
- **Sticked note position drift** — sticked notes now use `set_position(PhysicalPosition)` after build (matching the official tauri-plugin-window-state approach) instead of the builder's `position()` method

## [0.7.3] - 2026-03-01
Finder integration, auto-updater improvements, and cleanup

### Added
- **macOS Finder "Open With" support** — Stik now registers as a markdown editor; double-click or right-click any `.md`/`.markdown` file in Finder to open it directly in Stik (contributed by [@ildunari](https://github.com/ildunari))

### Changed
- **Smarter auto-updater** — update check now uses a 15s timeout, deduplicates already-installed updates, and avoids re-downloading the same version on repeated launches

### Fixed
- **Non-blocking file reads** — files opened via Finder are read asynchronously (`spawn_blocking`) to avoid blocking the event loop

### Removed
- **Product Hunt launch notice** — removed the one-time popup now that the launch window has passed

## [0.7.2] - 2026-02-23
Product Hunt launch support

### Added
- **Product Hunt launch notice** — one-time popup on first open after launch (Feb 24, 2026 00:01 PST) linking to the Product Hunt page for upvotes and feedback. Dismisses permanently on click

## [0.7.1] - 2026-02-23
Appearance settings and zen mode polish

### Added
- **Font picker** — choose from 9 curated Google Fonts (3 sans-serif, 3 serif, 3 monospace) loaded lazily on first use; or import any local font (TTF/OTF/WOFF/WOFF2) from disk via file dialog. Persisted per-settings, applies instantly to all editor windows
- **Window opacity** — background translucency slider (20–100%) in Settings > Appearance. Text stays crisp while the window fades, letting always-on-top notes reveal content underneath
- **Highlight color token** — `==text==` highlight now uses a visible amber default instead of the previous near-invisible coral. Custom themes gain a "Highlight" color picker to override per-theme

### Fixed
- **Zen mode window dragging** — restored native window dragging for all window types (capture, sticked) in zen mode (#41)
- **Zen mode button hit zones** — buttons in zen mode no longer intercept drag events, so dragging the window works anywhere on the header bar

## [0.7.0] - 2026-02-19
Custom theming, settings UX hardening, and startup crash resilience

### Added
- **Appearance system** — built-in themes, custom theme creation/editing, and import/export (JSON/TOML)
- **Contributor credit** — Appearance/theming system implemented by [@plyght](https://github.com/plyght)
- **Theme runtime tokens** — centralized theme resolution and DOM token application for editor/surface colors

### Changed
- **Settings layout sizing** — wider settings window/modal with improved tab visibility for the expanded menu bar
- **Settings scrolling UI** — hidden native scrollbar in settings content to align with existing design language

### Fixed
- **Autosave race in Settings** — settings saves are now coalesced/serialized to avoid overlapping writes and stale persistence
- **Theme migration behavior** — safer fallback from `active_theme` to legacy `theme_mode` when loading older/mismatched settings
- **Theme import validation** — strict color parsing rejects malformed color inputs
- **Crash hardening** — UTF-8 boundary-safe slicing and panic-source cleanup in startup/runtime hot paths to prevent SIGABRT in release

## [0.6.6] - 2026-02-18
Security patch

### Fixed
- **Security: glib vulnerability** — bumped `glib` transitive dependency to `>=0.20.0` to address [GHSA-wrw7-89jp-8q8g](https://github.com/advisories/GHSA-wrw7-89jp-8q8g) / RUSTSEC-2024-0429. Unsound `Iterator` and `DoubleEndedIterator` implementations in `VariantStrIter` (medium severity)

## [0.6.5] - 2026-02-18
Inline images, RTL support, zen mode, and quality-of-life improvements (#37)

### Added
- **Inline image rendering** — pasted/dropped images render as live previews inside the editor. Click to reveal raw markdown for editing, move cursor away to re-render. Broken images show a placeholder
- **RTL and bidirectional text support** — three modes (Auto/LTR/RTL) in Settings > Editor. Auto mode detects direction per line using the browser's Unicode Bidi Algorithm, ideal for Arabic, Hebrew, and mixed-language notes
- **Zen mode** — press Cmd+. (customizable in Settings > Shortcuts) to toggle distraction-free writing. Hides header, footer, and formatting toolbar
- **Hide menu bar icon** — toggle in Settings > Editor to remove the tray icon from the menu bar. Stik remains accessible via global shortcuts
- **Capture window size persistence** — the quick capture window remembers its size across sessions. Resize once, and it stays

### Fixed
- **Image save bug** — notes containing images now save correctly. Reads editor content directly from CodeMirror's document at save time instead of relying on async state

## [0.6.4] - 2026-02-17
Heading fold/collapse

### Added
- **Heading fold/collapse** — hover any heading (H1–H3) to reveal a chevron; click to collapse everything below until the next same-or-higher-level heading. Folded chevron stays visible in coral. Placing cursor in folded area auto-expands. Restores feature lost during TipTap→CM6 migration (#36)

## [0.6.3] - 2026-02-16
Discord link refresh, auto-updater toggle, and YouTube demo

### Added
- **Auto-updater toggle** — disable background update checks from Settings > Privacy (enabled by default)
- **YouTube demo link** — added to README header navigation

### Changed
- **Discord invite link** — updated across README, CONTRIBUTING, and in-app settings

## [0.6.2] - 2026-02-16
Vim command-mode reliability and markdown link UX fixes

### Added
- **Cmd-hover link affordance** — while holding Cmd, external markdown/bare links now show a pointer cursor before click
- **Targeted regression tests** — added coverage for link insertion selection, link marker hiding, Vim command callback routing, `:` command-bar trigger logic, and visual-arrow handling

### Fixed
- **`Cmd+K` URL selection placement** — link insertion now selects only `url`, so replacing destination works in one pass
- **Markdown link preview rendering** — when cursor is outside a link, `[`, `]`, `(`, `)`, and URL are hidden, leaving clean linked text
- **Vim `:wq` / `:x` execution path** — ex commands now invoke save-and-close handlers instead of incorrectly toggling command mode
- **Vim `:` command bar trigger** — pressing `:` in normal/visual mode reliably opens the custom command bar
- **Vim visual highlight visibility** — enabled CM6 `drawSelection()` so visual selections remain visible despite Vim's transparent native selection styling
- **Arrow-key behavior in visual mode** — arrow keys are explicitly routed through Vim while visual mode is active, preventing accidental visual-mode exit

## [0.6.1] - 2026-02-15
Capture window stability and auto-updater fix

### Fixed
- **Ghost process from auto-updater in dev mode** — `downloadAndInstall()` was extracting to a temp dir and spawning a second Stik process from an older release, causing two instances to compete for the global shortcut. Auto-updater now skips in dev builds
- **Stale content on fast Escape** — `handleSaveAndClose` reads from a ref instead of React state closure, preventing "/" or empty content from being saved when typing + Escape outraces React's render flush
- **Folder picker stuck open after blur-auto-hide** — hiding the window via blur (switching to another app) bypassed `handleSaveAndClose`, leaving `showPicker=true` on reopen. Picker now resets on window focus
- **Escape ignored with folder picker open** — pressing Escape when the folder picker was visible was a no-op; now explicitly dismisses the picker (next Escape saves/closes)
- **CM6 autocomplete not reopening after clear** — after a hide/show cycle, CodeMirror's "explicitly closed" state prevented `activateOnTyping` from showing slash commands. Now forces `startCompletion` when a slash prefix is detected
- **Blur-auto-hide false triggers** — debounced with 140ms delay + grace period to prevent OS focus event races from hiding the window during shortcut-triggered reopen

### Changed
- **Drop cursor styling** — separated from main cursor; uses subtle 35% opacity instead of solid coral

## [0.6.0] - 2026-02-14
Unified Command Palette, CodeMirror editor, interactive tables, and Apple Notes import

### Added
- **Unified Command Palette** — merged Search (`Cmd+Shift+P`) and Manager (`Cmd+Shift+M`) into a single two-pane window with folder sidebar + note list. Both shortcuts open the same palette
- **Sidebar position toggle** — switch Command Palette sidebar between left and right, persisted in settings
- **Inline note creation** — create notes directly from the Command Palette via the "New Note" footer button
- **CodeMirror 6 editor** — replaced Tiptap with CodeMirror for source-mode markdown editing with syntax highlighting, better performance, and extensibility
- **Interactive table widgets** — markdown tables render as editable rich widgets with Tab/Shift+Tab cell navigation, right-click context menu (insert/delete rows and columns), and keyboard exits (Escape, Enter from last row)
- **Horizontal rule widgets** — `---` renders as a styled divider line in the editor
- **Slash commands** — type `/` at line start for Notion/Raycast-style template insertion (headings, lists, code blocks, tables, templates)
- **Custom user templates** — define reusable slash command templates in Settings with `{{cursor}}`, `{{date}}`, `{{time}}`, `{{day}}` placeholders
- **Read-only Apple Notes import** — browse and import notes from Apple Notes via SQLite + protobuf parsing (#29)
- **Note template library** — built-in `/meeting`, `/standup`, `/journal`, `/brainstorm`, `/retro`, `/proscons`, `/weekly` templates with dynamic date insertion

### Changed
- **Editor engine** — migrated from Tiptap (ProseMirror) to CodeMirror 6 for native markdown source editing
- **Window consolidation** — `search` and `manager` windows replaced by single `command-palette` window
- **PostIt footer** — two separate search/manager buttons consolidated into single Command Palette button

### Fixed
- **Table cursor trap** — block-level table widgets at document end no longer trap the cursor; trailing newline auto-inserted
- **Tauri capability permissions** — `command-palette` window added to capability allow-list, fixing `event.emit` errors
- **Settings race condition** — centralized `saveAndEmitSettings` helper prevents concurrent settings mutations from overwriting each other

## [0.5.0] - 2026-02-11
Editor toolbar, font zoom, and quality-of-life fixes

### Added
- **Formatting toolbar** — bottom bar with quick-access buttons for heading (H1/H2/H3 dropdown), bold, italic, strikethrough, inline code, link, blockquote, bullet list, ordered list, task list, and highlight. Active state follows cursor position in real-time
- **Link button integration** — toolbar link button dispatches `Cmd+K` to open the existing LinkPopover editor, no separate prompt
- **Toolbar toggle** — show/hide formatting bar via footer button (T icon), persisted in localStorage. Auto-hidden in vim mode
- **Configurable font size** — `Cmd+`/`Cmd-` to zoom editor text (range 12-48px), `Cmd+0` to reset. Stepper in Settings > Editor. Headings and code scale proportionally
- **Root-level notes** — save notes directly to `~/Documents/Stik/` without requiring a folder. Shows "Stik" badge when no folder is set
- **Footer quick-access buttons** — search, manager, and settings buttons in the PostIt footer for all window types
- **Community standards** — added CONTRIBUTING.md, SECURITY.md, issue templates, and PR template

### Fixed
- **Image assets cleaned up on delete/move** — deleting a note removes its `.assets/` images; moving a note relocates them to the target folder
- **Editor content preserved on folder switch** — folder picker no longer clears typed content when switching folders
- **Stale index after folder delete** — NoteIndex and EmbeddingIndex entries are purged when a folder is deleted, preventing ghost notes in search
- **Highlight 1-char bug** — highlight button now requires a text selection (mark's `inclusive:false` caused stored marks to last only 1 character)
- **Image export hides chrome** — "Copy as image" now hides buttons, toolbar, and action bar, showing only the styled note content
- **Image export rounded corners** — screenshot clips to the PostIt's 14px border-radius instead of rectangular webview bounds
- **Toolbar horizontal scroll** — formatting bar scrolls horizontally on narrow windows with hidden scrollbar

### Changed
- **Settings-changed event on folder delete** — capture window re-resolves default folder after deletion

## [0.4.4] - 2026-02-10
Features, privacy, and search improvements

### Added
- **Hide dock icon** — tray-only mode via Settings > Editor
- **Folder colors** — assign colors to folders, reflected in search badges and folder picker
- **Customizable system shortcuts** — rebind Cmd+Shift+P/M/L/, in Settings > Shortcuts
- **Anonymous analytics** — privacy-respecting usage telemetry via PostHog (EU endpoint, opt-out in Settings > Privacy)
- **Analytics notice popup** — one-time "What's New" notice for existing users with opt-out path and community links
- **Privacy settings tab** — toggle analytics, view what's collected, copy anonymous device ID
- **Folder-scoped search** — filter search results by folder via popover in the search header (#23)

### Fixed
- **Viewing window left open after note deletion** — close viewing window when its note is deleted from another window (#19)
- **Disabled folder shortcuts persisting** — normalization now force-enables all visible shortcuts

## [0.4.3] - 2026-02-09
Stability fixes for link editing and settings

### Fixed
- **Escape behavior while editing links** — pressing `Esc` in the link edit popover now closes only the popover and returns focus to the note, without closing/saving the whole capture window
- **Settings side-effect folder recreation** — opening Settings no longer recreates deleted folders (including `Inbox`) during Git status checks

## [0.4.2] - 2026-02-09
Community and support links

### Added
- **Settings footer social links** — new Help/X/Discord quick actions next to the app version in both settings surfaces (modal and standalone settings window)
- **Help action in app settings** — one-click support contact via `mailto:help@stik.ink`

### Changed
- **Support channels updated** — README now points to `help@stik.ink` plus official X and Discord community links

## [0.4.1] - 2026-02-09
Editing and reliability polish

### Added
- **Link shortcuts for selected text** — press `Cmd+K` or `Cmd+L` to open link editing for the current selection
- **Cleaner note previews** — search/manager now derive readable titles/snippets from markdown content
- **Desktop image drop support** — drag images from Finder/Desktop into notes with local-path import into `.assets/`

### Fixed
- **Link navigation control** — plain click no longer navigates externally; use `Cmd+Click` or popover Open action
- **Reopen last note (`Cmd+Shift+L`)** — now tracks notes opened from Search and Manager, not only newly saved notes
- **Image reopen rendering** — dropped/pasted images persist with normalized paths and render correctly after reopening notes
- **Folder edge-case behavior** — capture/save flow now works when default/requested folders are missing or folder sets are empty

### Changed
- **Folder selection logic** centralized via shared fallback resolution for capture and save operations
- **Image path normalization** now supports `asset://localhost`, `asset.localhost`, and `file://` forms
- **Link interaction model** aligns editor behavior with popover controls and explicit shortcut-based navigation

## [0.4.0] - 2026-02-08
Editor power-ups & quality of life

### Added
- **Vim mode** — full modal editing with Normal, Insert, Visual, and Command modes. Toggle in Settings > Editor. Includes status bar indicator, text objects (`ciw`, `ci"`, `di(`), and `:wq`/`:q!` commands
- **Highlighting** (`==text==`) — wrap text in `==` for visual emphasis. Renders with coral background, roundtrips to markdown, adapts to light/dark theme
- **Collapsible headings** — hover any heading to reveal a fold chevron. Click to collapse/expand content beneath. Purely visual, no markdown markers
- **Wiki-links** (`[[slug]]`) — type `[[` to autocomplete and link to other notes. Renders as styled inline element, click to open the referenced note. Stored as literal `[[slug]]` in markdown
- **Link popover** — place cursor inside any link to see a floating toolbar with Open, Copy, Edit, and Unlink actions
- **Markdown link input rule** — type `[text](url)` to instantly create a clickable link with URL normalization and protocol safety
- **Image paste & drop** — paste or drag images into the editor. Saved to `.assets/` alongside the note, referenced as standard markdown images
- **Task list input fix** — typing `- [ ] ` now correctly creates a checkbox (fixes BulletList/TaskItem conflict)
- **Custom notes directory** — choose any folder as your notes root via Settings > Folders
- **Reopen last note** (`Cmd+Shift+L`) — instantly reopen the most recently saved note
- **Theme customization** — System, Light, and Dark modes with live switching
- **Automated test suite** — 38 unit tests covering URL normalization, XSS escaping, slug generation, and markdown roundtrips

### Fixed
- **Link click behavior** — Cmd+Click opens external links, regular click positions cursor (no accidental navigation)
- **Dangerous URL protocols** — `javascript:`, `data:`, and `file:` URLs are rejected and sanitized
- **XSS in wiki-link slugs** — HTML entities escaped in rendered wiki-link nodes
- **Sticky highlight formatting** — `inclusive: false` prevents highlight from bleeding into adjacent text

### Changed
- **Editor extensions** refactored into individual files under `src/extensions/`
- **CI/CD pipeline** — secrets scoped to specific workflow steps, Vercel deploy hook secured

## [0.3.3] - 2026-02-07
Silent auto-updates

### Added
- **Auto-updater** — silently downloads updates in the background, applies on next app restart
- **Version display** — app version shown in the settings footer

## [0.3.2] - 2026-02-07
Polish & bug fixes

### Fixed
- **Double tray icon** — removed duplicate tray icon created by both config and code (#2)
- **Menu bar icon appearance** — use a proper macOS template icon that adapts to light/dark mode (#3)
- **Ctrl registered as Cmd in shortcuts** — Ctrl (⌃) and Cmd (⌘) are now correctly distinguished when recording and registering shortcuts (#4)
- **Links not clickable** — Cmd+Click on links in the editor now opens them in the default browser; cursor changes to pointer when Cmd is held over a link (#5)

### Changed
- Homebrew install instructions updated to use `0xMassi/stik` tap

## [0.3.1] - 2026-02-06

## [0.3.0] - 2026-02-06
On-device AI & git sharing

### Added
- **On-device AI features** powered by DarwinKit sidecar (Apple NaturalLanguage framework, zero cloud dependency)
  - **Semantic search** — hybrid text + semantic results in search modal with similarity badges
  - **Folder suggestions** — real-time AI-powered folder pill while capturing notes, based on folder centroids
  - **Note embeddings** — background embedding build on launch, persisted to `~/.stik/embeddings.json`
- **Git sharing** — sync folders via git with configurable repository layout (monorepo or per-folder), background auto-sync worker
- **Capture streak** — consecutive-day counter shown in tray menu and settings
- **On This Day** — daily notification resurfacing notes from the same date in prior years
- **Share as clipboard** — copy notes as rich text, plain markdown, or image snapshot to clipboard
- **AI settings tab** — dedicated settings section to enable/disable AI features with privacy documentation
- **Raycast-style settings redesign** — horizontal tab bar with SVG icons, scrollable content, resizable window (620x700)

### Fixed
- **Language-aware embeddings** — Apple NLEmbedding uses different vector dimensions per language (e.g. English=512, Italian=640); similarity and centroid calculations now filter by matching language
- **Folder suggestion threshold** — lowered from 0.5 to 0.35 for better suggestions with small note collections
- **Settings overflow** — content was clipped by `overflow: hidden` on root elements; now properly scrollable

### Changed
- **Settings window** enlarged from 500x600 to 620x700, now resizable with min size 520x500
- **Tab state** moved from `SettingsContent` to `SettingsModal` — content component is now a pure renderer
- **Insights layout** changed from 2-column grid to vertical stack for better scrolling

## [0.2.0] - 2026-02-06
Security hardening & architecture refactor

### Added
- **In-memory note index** for fast search and listing (two-tier: preview match then full-file fallback)
- **On-demand content loading** — search/list results no longer carry full file content over IPC
- **Versioned JSON storage** — settings and sticked notes use `{ version, data }` envelope with auto-migration
- **Path traversal validation** on folder/note names
- **Content Security Policy** — restrictive CSP for the webview
- **Scoped filesystem permissions** — limited to `~/Documents/Stik/` and `~/.stik/`
- **Toast notification** when attempting to delete the protected Inbox folder
- **Shared TypeScript types** (`src/types/index.ts`) used across all components
- **Extracted `SettingsContent` component** — shared settings UI for both window and dialog modes

### Fixed
- **Capture window no longer hides on blur when content is present** — only auto-hides when editor is empty
- **Pinned note content loss on quit** — debounced content autosave for sticked notes
- **Filename collisions** — UUID suffix prevents same-second overwrites
- **Pinned note position reset** — window position persisted after centering
- **Viewing note cache leak** — entries cleaned up on window close
- **Mutex crashes** — all `.lock().unwrap()` replaced with poisoned-mutex recovery
- **Sticked notes JSON corruption** — atomic writes via temp file + rename
- **Search highlight bug** — fixed stateful global regex with index parity
- **Stale folder selection** — selection resets after folder deletion in manager
- **Viewing window stuck on "Loading..."** — error state with close button

### Changed
- **Split `main.rs`** from 991 lines into 5 focused modules: `state.rs`, `shortcuts.rs`, `windows.rs`, `tray.rs`, and slim orchestrator `main.rs` (~120 lines)
- **`SettingsModal`** reduced from ~465 to ~135 lines via shared `SettingsContent`

### Removed
- `tauri-plugin-store` dependency (unused)
- Unused settings commands (`get_shortcut_mappings`, `save_shortcut_mapping`, `set_setting`)

## [0.1.0] - 2026-02-05
First release

### Added
- **Core capture flow**: Global shortcut summons post-it, type, close to save
- **Folder organization**: Inbox, Work, Ideas, Personal, Projects (customizable)
- **Global shortcuts**:
  - `Cmd+Shift+S` - New note in default folder
  - `Cmd+Shift+F` - Select folder then capture
  - `Cmd+Shift+P` - Search all notes
  - `Cmd+Shift+M` - Manage notes & folders
  - `Cmd+Shift+,` - Open settings
- **Search modal**: Find notes instantly with highlighted matches
- **Manager modal**: Browse folders, expand to see notes, delete/rename
- **Folder selector**: Quick folder switching with create-on-the-fly
- **Pin notes**: Keep important notes floating on desktop
- **Settings**: Configure shortcuts, default folder, folder-specific hotkeys
- **File management**:
  - Delete notes (`Backspace` in search/manager)
  - Move notes between folders (`Cmd+M` in search)
  - Delete folders (`Backspace` in folder selector)
  - Rename folders (`Cmd+R` in folder selector)
- **Safety**: Inbox folder protected from deletion/rename
- **Rich text editor**: Markdown support via Tiptap
- **Local storage**: Notes saved as `.md` files in `~/Documents/Stik/`

### Technical
- Built with Tauri 2.0 (Rust backend, React frontend)
- React 19 with TypeScript
- Tailwind CSS for styling
- Tiptap for rich text editing

---

## Version History

| Version | Date | Highlights |
|---------|------|------------|
| 0.7.8 | 2026-03-11 | Hotfix: DarwinKit sidecar path resolution + CI universal binary fix |
| 0.7.7 | 2026-03-10 | Hotfix: remove restricted iCloud entitlements blocking app launch |
| 0.7.6 | 2026-03-10 | Note locking (AES-256-GCM + Touch ID), iCloud sync, storage abstraction, window positioning fix |
| 0.7.5 | 2026-03-04 | Fenced code block cursor jump fix, heading dropdown clip fix, smart Enter/Backspace in fenced code |
| 0.7.4 | 2026-03-02 | Window position persistence, multi-monitor support, cursor position persistence |
| 0.7.3 | 2026-03-01 | macOS Finder integration, smarter auto-updater, non-blocking file reads |
| 0.7.2 | 2026-02-23 | Product Hunt launch notice |
| 0.7.1 | 2026-02-23 | Font picker (9 Google Fonts + local import), window opacity slider, amber highlight color, zen mode drag fix |
| 0.7.0 | 2026-02-19 | Custom themes + import/export, autosave race fix, settings layout resize, startup crash hardening |
| 0.6.6 | 2026-02-18 | Security patch: glib vulnerability fix |
| 0.6.5 | 2026-02-18 | Inline images, RTL support, zen mode, hide tray icon, capture window size persistence |
| 0.6.4 | 2026-02-17 | Heading fold/collapse |
| 0.6.3 | 2026-02-16 | Discord link refresh, auto-updater toggle, YouTube demo |
| 0.6.2 | 2026-02-16 | Vim `:wq` + `:` command mode fixes, visible visual selection, arrow stability in visual mode, improved markdown link UX |
| 0.6.1 | 2026-02-15 | Auto-updater dev fix, capture window race conditions, blur-auto-hide debounce |
| 0.6.0 | 2026-02-14 | Unified Command Palette, CodeMirror 6 editor, interactive tables, slash commands, Apple Notes import |
| 0.5.0 | 2026-02-11 | Formatting toolbar, font zoom, root-level notes, image export cleanup, community standards |
| 0.4.4 | 2026-02-10 | Dock icon hiding, folder colors, custom shortcuts, anonymous analytics, folder-scoped search |
| 0.4.3 | 2026-02-09 | Escape handling in link popover fixed; opening Settings no longer recreates deleted folders |
| 0.4.2 | 2026-02-09 | Help/X/Discord links in settings footer, updated support/contact links |
| 0.4.1 | 2026-02-09 | Link shortcuts (`Cmd+K`/`Cmd+L`), stronger link navigation control, robust image drag/drop and reopen, last-note reopen fixes |
| 0.4.0 | 2026-02-08 | Vim mode, highlighting, collapsible headings, wiki-links, link popover, image handling, themes |
| 0.3.3 | 2026-02-07 | Built-in auto-updater, version display in settings |
| 0.3.2 | 2026-02-07 | Fix double tray icon, menu bar icon, Ctrl/Cmd shortcuts, clickable links |
| 0.3.0 | 2026-02-06 | On-device AI (semantic search, folder suggestions, embeddings), git sharing, settings redesign |
| 0.2.0 | 2026-02-06 | Security hardening, performance index, architecture refactor |
| 0.1.0 | 2026-02-05 | Initial release - core capture, search, manager |

[0.7.8]: https://github.com/0xMassi/stik_app/compare/v0.7.7...v0.7.8
[0.7.7]: https://github.com/0xMassi/stik_app/compare/v0.7.6...v0.7.7
[0.7.6]: https://github.com/0xMassi/stik_app/compare/v0.7.5...v0.7.6
[0.7.5]: https://github.com/0xMassi/stik_app/compare/v0.7.4...v0.7.5
[0.7.4]: https://github.com/0xMassi/stik_app/compare/v0.7.3...v0.7.4
[0.7.3]: https://github.com/0xMassi/stik_app/compare/v0.7.2...v0.7.3
[0.7.2]: https://github.com/0xMassi/stik_app/compare/v0.7.1...v0.7.2
[0.7.1]: https://github.com/0xMassi/stik_app/compare/v0.7.0...v0.7.1
[0.7.0]: https://github.com/0xMassi/stik_app/compare/v0.6.6...v0.7.0
[0.6.6]: https://github.com/0xMassi/stik_app/compare/v0.6.5...v0.6.6
[0.6.5]: https://github.com/0xMassi/stik_app/compare/v0.6.4...v0.6.5
[0.6.4]: https://github.com/0xMassi/stik_app/compare/v0.6.3...v0.6.4
[0.6.3]: https://github.com/0xMassi/stik_app/compare/v0.6.2...v0.6.3
[0.6.2]: https://github.com/0xMassi/stik_app/compare/v0.6.1...v0.6.2
[0.6.1]: https://github.com/0xMassi/stik_app/compare/v0.6.0...v0.6.1
[0.6.0]: https://github.com/0xMassi/stik_app/compare/v0.5.0...v0.6.0
[0.5.0]: https://github.com/0xMassi/stik_app/compare/v0.4.4...v0.5.0
[0.4.4]: https://github.com/0xMassi/stik_app/compare/v0.4.3...v0.4.4
[0.4.3]: https://github.com/0xMassi/stik_app/compare/v0.4.2...v0.4.3
[0.4.2]: https://github.com/0xMassi/stik_app/compare/v0.4.1...v0.4.2
[0.4.1]: https://github.com/0xMassi/stik_app/compare/v0.4.0...v0.4.1
[0.4.0]: https://github.com/0xMassi/stik_app/compare/v0.3.3...v0.4.0
[0.3.3]: https://github.com/0xMassi/stik_app/compare/v0.3.2...v0.3.3
[0.3.2]: https://github.com/0xMassi/stik_app/compare/v0.3.1...v0.3.2
[0.3.1]: https://github.com/0xMassi/stik_app/compare/v0.3.0...v0.3.1
[0.3.0]: https://github.com/0xMassi/stik_app/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/0xMassi/stik_app/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/0xMassi/stik_app/releases/tag/v0.1.0

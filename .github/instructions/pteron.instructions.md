---
applyTo: "pteron/**"
---

# Pteron Extension

**Pteron** (Greek for 'Wing') is a cross-browser browser extension built with [WXT](https://wxt.dev/) and **React**. It lives in `pteron/`.

## Vocabulary

| Concept | UI Label |
|---|---|
| Saved shortcut | **Link** |
| Contextual note | **Note** |
| Collection | **Saved Links** |
| Omnibox trigger | `p` |
| Direct navigation | `p/<keyword>` |

## File Map

| Path | Purpose |
|------|---------|
| `wxt.config.js` | WXT metadata, omnibox keyword (`p`), commands. Bump version on release. |
| `src/entrypoints/background.js` | Omnibox logic, visit tracking, `p/` navigation, settings, migration |
| `src/utils/url.js` | Pure URL utilities (no side effects) |
| `src/utils/storage.js` | `chrome.storage.sync` helpers — all storage access goes through here |
| `src/utils/exportImport.js` | Export-to-JSON / import-from-JSON logic |
| `src/components/App.jsx` | Top-level view router; owns active view state |
| `src/components/views/` | One component per view |
| `src/components/dialogs/` | Modal dialogs (Export, Import) |
| `src/components/ui/` | Shared UI primitives (ViewHeader, ToggleSwitch, ShortcutHint) |
| `src/hooks/usePopupInit.js` | Reads session storage, determines the initial view on popup open |
| `src/hooks/useStorage.js` | Shared async-action hook |
| `src/styles/index.css` | All popup styles — Aegean palette, dark-mode |
| `store-listing.txt` | Chrome Web Store description **(keep in sync)** |

## Store Listing

**Always keep `store-listing.txt` up to date** whenever you make a user-facing change. Use consumer-friendly language focused on benefits.

## Storage Key Conventions

Links are stored in `chrome.storage.sync` under the keyword itself (e.g. `"github"`, `"docs"`). All **non-keyword** keys **must** begin with `__`:

| Key | Purpose |
|-----|---------|
| `__settings` | User preferences object |
| `__blockedSuggestions` | Array of URLs blocked from auto-suggestions |
| `__note_<keyword>` | Note text for a specific link |

**Never** add a non-keyword sync key without the `__` prefix.  
**Never** allow a user to save a keyword starting with `__`.

All storage access goes through `src/utils/storage.js`.

## Design System: "The Aegean"

### Colors
```
--color-accent:       #2563EB  /* Pteron Blue — buttons, active states */
--color-accent-hover: #1D4ED8  /* Darker blue for hover */
--color-surface:      #FFFFFF  /* Alabaster — main background */
--color-cloud:        #F1F5F9  /* Card / input backgrounds */
--color-text:         #0F172A  /* Deep Sea — primary text */
--color-muted:        #64748B  /* Slate — metadata, shortcuts */
--color-navy:         #1E293B  /* Dark mode cards */
--color-midnight:     #0B0E14  /* Dark mode background */
--color-note-gold:    #F59E0B  /* Note indicator accent */
```

### Design Rules
- Border radius: `12px` everywhere (inputs, cards, buttons)
- Headlines: semi-bold, `letter-spacing: -0.02em`
- Keywords: monospace font
- Card hover: `box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1)`

## TypeScript Conventions

- **Use TypeScript (`.ts` / `.tsx`) for all new files** — utilities, hooks, and components.
- Existing `.js` / `.jsx` files are being migrated incrementally; do not revert migrated files back to JS.
- Strict mode is enabled (`"strict": true` in `.wxt/tsconfig.json`) — no `any` without justification.
- Prefer explicit return types on exported functions and hooks.
- Chrome extension globals (`chrome.*`) are provided by WXT's bundled types — no `@types/chrome` import needed.

## React Conventions

- All storage calls go through `src/utils/storage.js`
- Hooks in `src/hooks/`, shared UI in `src/components/ui/`
- Active view state owned by `App.jsx`; children receive navigation callbacks
- Use `useEffect` + `useState` for data loading

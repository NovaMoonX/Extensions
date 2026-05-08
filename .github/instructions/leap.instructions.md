---
applyTo: "leap-site-navigation/**"
---

# Leap Extension

The **Leap** extension is the cross-browser successor to Quick Links, built with [WXT](https://wxt.dev/) and **React**. It lives in `leap-site-navigation/`.

## Vocabulary

| Old (Quick Links) | New (Leap) |
|---|---|
| Quick Link / Bookmark | **Lily Pad** |
| Notes | **Leaflets** |
| Collection of links | **The Pond** |
| `ql` omnibox trigger | `lp` omnibox trigger |
| `ql/<keyword>` | `lp/<keyword>` |

## File Map

| Path | Purpose |
|------|---------|
| `wxt.config.js` | WXT metadata, omnibox keyword (`lp`), commands. Bump version on release. |
| `src/entrypoints/background.js` | Omnibox logic, visit tracking, `lp/` navigation, settings, migration |
| `src/utils/url.js` | Pure URL utilities (no side effects) |
| `src/utils/storage.js` | `chrome.storage.sync` helpers — all storage access goes through here |
| `src/utils/exportImport.js` | Export-to-JSON / import-from-JSON logic |
| `src/components/App.jsx` | Top-level view router; owns active view state |
| `src/components/views/` | One component per view (7 views) |
| `src/components/dialogs/` | Modal dialogs (Export, Import) |
| `src/components/ui/` | Shared UI primitives (ViewHeader, ToggleSwitch, ShortcutHint) |
| `src/hooks/usePopupInit.js` | Reads session storage, determines the initial view on popup open |
| `src/hooks/useStorage.js` | Shared async-action hook |
| `src/styles/index.css` | All popup styles — Midnight Pond palette, dark-mode |
| `store-listing.txt` | Chrome Web Store description **(keep in sync)** |

## Store Listing

**Always keep `store-listing.txt` up to date** whenever you make a user-facing change. Specifically:

- Add/change/remove bullets in the **What You Get** section to match the feature.
- Use consumer-friendly language — focus on benefits, not implementation details.
- Add a new bullet with an emoji for new features; delete bullets for removed ones.

## Storage Key Conventions

Lily Pads are stored in `chrome.storage.sync` under the keyword itself (e.g. `"github"`, `"docs"`). All **non-keyword** keys **must** begin with `__`:

| Key | Purpose |
|-----|---------|
| `__settings` | User preferences object |
| `__blockedSuggestions` | Array of URLs blocked from auto-suggestions |
| `__note_<keyword>` | Leaflet text for a specific Lily Pad |

**Never** add a non-keyword sync key without the `__` prefix.  
**Never** allow a user to save a keyword that starts with `__` — it is rejected in `getKeywordError()` inside `FormView.jsx`.

All storage access should go through `src/utils/storage.js`. Do not call `chrome.storage` directly from components.

## Brand / Color Palette ("Midnight Pond")

| Token | Value | Usage |
|-------|-------|-------|
| Surface White | `#F9FBF9` | Card / preview backgrounds |
| Leaf Green | `#4CAF50` | Primary accent (buttons, active states) |
| Deep Moss | `#1B3022` | Dark-mode base (leaflet label backgrounds) |
| Leaflet Gold | `#FFD700` | Future accent for Leaflets / Reminders |

## React Conventions

- **Components** live in `src/components/`. Each view is a separate file in `views/`.
- **Shared UI** (reusable primitives) lives in `src/components/ui/`.
- **Hooks** live in `src/hooks/`.
- **State** for active view lives in `App.jsx`; child components receive callbacks to navigate.
- **Storage calls** always go through `src/utils/storage.js` — never call `chrome.storage` directly inside components.
- Use `async/await` for all storage operations; handle errors gracefully.
- Prefer `useEffect` + `useState` for data loading; avoid class components.

## Cross-Browser

- `npm run build` → Chrome MV3
- `npm run build:firefox` → Firefox MV2

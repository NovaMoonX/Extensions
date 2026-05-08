# Copilot Instructions

## Leap Extension (Primary / Active Development)

The **Leap** extension is the cross-browser successor to Quick Links, built with [WXT](https://wxt.dev/). It lives in `leap-site-navigation/`.

### Store Listing

A Chrome Web Store listing description is maintained at:
`leap-site-navigation/store-listing.txt`

**Always keep `store-listing.txt` up to date** whenever you make changes to the Leap extension. Specifically:

- If you add, remove, or change a user-facing feature, update the matching bullet in the **What You Get** section.
  - Keep these updates consumer-friendly and avoid technical jargon. Focus on the benefits and features that users will experience.
- If the feature is new, add a new entry under **What You Get** with an appropriate emoji and clear description.
- If a feature is removed, delete or reword its entry.

### Vocabulary

| Old (Quick Links) | New (Leap) |
|---|---|
| Quick Link / Bookmark | **Lily Pad** |
| Notes | **Leaflets** |
| Collection of links | **The Pond** |
| `ql` omnibox trigger | `lp` omnibox trigger |
| `ql/<keyword>` | `lp/<keyword>` |

### Extension File Map

| File | Purpose |
|------|---------|
| `wxt.config.js` | WXT/extension metadata, omnibox keyword (`lp`), commands. Update version as needed. |
| `src/entrypoints/background.js` | Omnibox logic, visit tracking, `lp/` trigger, settings enforcement |
| `src/utils/url.js` | Pure utility functions (URL parsing, visit frequency) |
| `src/entrypoints/popup/index.html` | Popup shell — all views declared here |
| `src/entrypoints/popup/main.js` | Popup logic — view switching, storage reads/writes, export/import |
| `src/entrypoints/popup/style.css` | Popup styles — Midnight Pond palette, dark-mode support |
| `store-listing.txt` | Chrome Web Store listing description **(keep in sync)** |

### Storage Key Conventions

Lily Pads are stored in `chrome.storage.sync` using the keyword itself as the key (e.g., `"github"`, `"docs"`). All other (non-keyword) keys **must** begin with two underscores (`__`) to prevent collisions with user-defined keywords. Examples:

| Key | Purpose |
|-----|---------|
| `__settings` | User preferences object |
| `__blockedSuggestions` | Array of URLs the user has blocked from auto-suggestions |
| `__note_<keyword>` | Leaflet text attached to a specific Lily Pad |

**Never** introduce a new non-keyword sync storage key without the `__` prefix. Keywords that begin with `__` are rejected at save time so users cannot accidentally overwrite internal state.

### Brand / Color Palette ("Midnight Pond")

| Token | Value | Usage |
|-------|-------|-------|
| Surface White | `#F9FBF9` | Card / preview backgrounds |
| Leaf Green | `#4CAF50` | Primary accent (buttons, highlights) |
| Deep Moss | `#1B3022` | Dark mode base for notes/label backgrounds |
| Leaflet Gold | `#FFD700` | Future accent for Leaflets/Reminders |

---

## Quick Links Extension (Legacy / Chrome-only)

The original Chrome-only Quick Links extension lives in `chrome-tutorials/handle-events-with-service-workers/`. It is in maintenance mode. The same storage key conventions (`__` prefix) apply here.

**Always keep `chrome-tutorials/handle-events-with-service-workers/store-listing.txt` up to date** whenever you make changes to this extension.

### Extension File Map

| File | Purpose |
|------|---------|
| `manifest.json` | Extension metadata, permissions, omnibox keyword. Update version number as needed. |
| `service-worker.js` | Omnibox logic, visit tracking, `ql/` trigger, settings enforcement |
| `service-worker.util.js` | Pure utility functions (URL parsing, visit frequency) |
| `popup.html` | Popup shell — all views declared here |
| `popup.js` | Popup logic — view switching, storage reads/writes |
| `popup.css` | Popup styles including dark-mode support |
| `store-listing.txt` | Chrome Web Store listing description **(keep in sync)** |

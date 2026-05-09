---
applyTo: "chrome-tutorials/handle-events-with-service-workers/**"
---

# Quick Links Extension (Legacy)

The original Chrome-only Quick Links extension. It is in **maintenance mode** — bug fixes only; no new features. Active development has moved to [Leap](../../leap-site-navigation/).

## File Map

| File | Purpose |
|------|---------|
| `manifest.json` | Extension metadata, permissions, omnibox keyword (`ql`). Bump version for releases. |
| `service-worker.js` | Omnibox logic, visit tracking, `ql/` trigger, settings enforcement |
| `service-worker.util.js` | Pure utility functions (URL parsing, visit frequency) |
| `popup.html` | Popup shell — all views declared here |
| `popup.js` | Popup logic — view switching, storage reads/writes |
| `popup.css` | Popup styles including dark-mode support |
| `store-listing.txt` | Chrome Web Store description **(keep in sync)** |

## Store Listing

**Always keep `store-listing.txt` up to date** whenever you make a user-facing change.

## Storage Key Conventions

Quick Links are stored in `chrome.storage.sync` under the keyword itself. All **non-keyword** keys **must** begin with `__`:

| Key | Purpose |
|-----|---------|
| `__settings` | User preferences object |
| `__blockedSuggestions` | Array of URLs blocked from auto-suggestions |
| `__note_<keyword>` | Note text for a specific quick link |

**Never** add a non-keyword sync key without the `__` prefix.  
Keywords starting with `__` are rejected in `getKeywordError()` inside `popup.js`.

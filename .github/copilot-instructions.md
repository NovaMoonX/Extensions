# Copilot Instructions

## Quick Links Extension

The Quick Links extension lives in `chrome-tutorials/handle-events-with-service-workers/`.

### Store Listing

A Chrome Web Store listing description is maintained at:
`chrome-tutorials/handle-events-with-service-workers/store-listing.txt`

**Always keep `store-listing.txt` up to date** whenever you make changes to the Quick Links extension. Specifically:

- If you add, remove, or change a user-facing feature, update the matching bullet in the **What You Get** section.
  - Keep these updates consumer-friendly and avoid technical jargon. Focus on the benefits and features that users will experience.
- If the feature is new, add a new entry under **What You Get** with an appropriate emoji and clear description.
- If a feature is removed, delete or reword its entry.

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

### Storage Key Conventions

Quick links are stored in `chrome.storage.sync` using the keyword itself as the key (e.g., `"github"`, `"docs"`). All other (non-keyword) keys **must** begin with two underscores (`__`) to prevent collisions with user-defined keywords. Examples:

| Key | Purpose |
|-----|---------|
| `__settings` | User preferences object |
| `__blockedSuggestions` | Array of URLs the user has blocked from auto-suggestions |
| `__note_<keyword>` | Note text attached to a specific quick link |

**Never** introduce a new non-keyword sync storage key without the `__` prefix. Keywords that begin with `_` are rejected at save time so users cannot accidentally overwrite internal state.

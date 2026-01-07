# Article Links Extension

A Chrome extension that automatically detects and displays all links within article content on any webpage.

## Description

Article Links enhances your reading experience by identifying all hyperlinks within article content and displaying them in a compact, organized badge. It extracts contextual information for each link, showing the sentence containing the link and providing quick access to the full URL.

## Features

- **Automatic Detection**: Scans article content for links in paragraphs, lists, blockquotes, and sections
- **Contextual Display**: Shows the sentence containing each link with the link text underlined
- **Domain Hints**: Displays hostname in parentheses when full URLs are hidden
- **Toggle Visibility**: Button to show/hide full URLs for cleaner reading
- **Smart Placement**: Badge positioned intelligently within the article flow
- **Responsive Design**: Long URLs wrap naturally within the badge
- **Zero State**: Displays a message when no links are found

## Files

- `manifest.json` - Extension configuration with content script permissions
- `scripts/links.js` - Main content script that analyzes and renders links
- `package.json` - npm configuration for Chrome types

## Usage

1. Navigate to any webpage containing an `<article>` element
2. The extension automatically scans for links and displays a badge
3. Click "Show full links" to reveal complete URLs
4. Click "Hide full links" to show only domain hints
5. Double-click any URL to select it for copying

## How It Works

The extension:
1. Searches for `<article>` elements on the page
2. Extracts links from content containers (paragraphs, lists, etc.)
3. Filters to only include valid HTTP/HTTPS links with text
4. Extracts the sentence context for each link
5. Renders a styled badge with all findings
6. Uses a MutationObserver to detect dynamically loaded articles

## Styling

- Badge: Light border, subtle shadow, responsive padding
- Links: Font weight 400, blue color (default browser styling)
- URLs: 12px font, opacity 0.6, word wrapping enabled
- Domain hints: 12px font, opacity 0.6, shown in parentheses
- Spacing: Adjusts between items based on URL visibility

## Development

Install Chrome types for better development experience:

```bash
npm install
```

## Permissions

- Runs on all HTTP and HTTPS pages (`https://*/*`, `http://*/*`)
- No special permissions required beyond content script injection

# Chrome Extension Tutorials

A collection of Chrome extensions built while following the [Chrome for Developers](https://developer.chrome.com/docs/extensions/get-started/tutorial/hello-world) getting started tutorials.

## Overview

These extensions are learning projects created by working through the official Chrome extension development tutorials. They demonstrate different aspects of extension development, from basic popup interfaces to content scripts that enhance web pages.

## Extensions

### [Hello World](./hello-world)
A minimal Chrome extension demonstrating the fundamentals of Manifest V3 extension development. Features a simple popup interface and serves as a starting point for learning Chrome extension basics.

### [Article Links](./run-scripts-on-every-page)
A content script-based extension that automatically detects and displays all links within article content on any webpage. Provides contextual information for each link with a toggleable interface for showing/hiding full URLs.

## Getting Started

Each extension folder contains its own README with usage instructions.

### General Installation Steps
1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" in the top right corner
3. Click "Load unpacked"
4. Select the folder of the extension you want to install

## Development Setup

Each extension includes Chrome types for better TypeScript/JavaScript development:

```bash
cd <extension-folder>
npm install
```

## Resources

- [Chrome Extension Documentation](https://developer.chrome.com/docs/extensions)
- [Hello World Tutorial](https://developer.chrome.com/docs/extensions/get-started/tutorial/hello-world)
- [Chrome Extension API Reference](https://developer.chrome.com/docs/extensions/reference)

## Creating New Tutorials

Use the included script to scaffold a new extension:

```bash
./new-tutorial.sh
```
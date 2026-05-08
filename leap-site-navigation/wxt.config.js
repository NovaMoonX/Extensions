import { defineConfig } from 'wxt';

export default defineConfig({
  srcDir: 'src',
  manifest: {
    name: 'Leap',
    description: 'Leap — Instant Navigation, Leaflets & Productivity',
    version: '2.0',
    permissions: ['storage', 'webNavigation', 'tabs'],
    host_permissions: ['<all_urls>'],
    omnibox: { keyword: 'lp' },
    commands: {
      'add-lily-pad': {
        suggested_key: { default: 'Ctrl+L', mac: 'Alt+L' },
        description: 'Add current page as Lily Pad'
      },
      'open-leaflets': {
        suggested_key: { default: 'Ctrl+Shift+M', mac: 'Alt+Shift+M' },
        description: 'Open Leaflets for current page'
      }
    }
  },
  browser: 'chrome',
  browsers: {
    firefox: {}
  }
});

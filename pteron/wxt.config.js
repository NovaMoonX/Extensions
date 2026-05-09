import { defineConfig } from 'wxt';

export default defineConfig({
  srcDir: 'src',
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'Pteron',
    description: 'Pteron — Shortcut your browser.',
    version: '1.0.0',
    permissions: ['storage', 'webNavigation', 'tabs'],
    host_permissions: ['<all_urls>'],
    omnibox: { keyword: 'p' },
    icons: {
      16: 'icons/icon-16.png',
      32: 'icons/icon-32.png',
      48: 'icons/icon-48.png',
      128: 'icons/icon-128.png',
    },
    action: {
      default_icon: {
        16: 'icons/icon-16.png',
        32: 'icons/icon-32.png',
        48: 'icons/icon-48.png',
        128: 'icons/icon-128.png',
      },
    },
    commands: {
      'save-link': {
        suggested_key: { default: 'Ctrl+L', mac: 'Alt+L' },
        description: 'Save current page as a Link'
      },
      'open-notes': {
        suggested_key: { default: 'Ctrl+Shift+M', mac: 'Alt+Shift+M' },
        description: 'Open Notes for current page'
      }
    }
  },
  browser: 'chrome',
  browsers: {
    firefox: {}
  }
});

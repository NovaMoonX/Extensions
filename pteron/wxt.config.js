import { defineConfig } from 'wxt';

export default defineConfig({
  srcDir: 'src',
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'Pteron: Shortcut your browser',
    description: 'Turns your address bar into a command center. Save links, navigate with p/keyword, attach notes, and sync across devices.',
    version: '1.4.0',
    permissions: ['storage', 'webNavigation', 'tabs', 'scripting'],
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
        suggested_key: { default: 'Ctrl+Shift+L', mac: 'Alt+Shift+L' },
        description: 'Open Notes for current page'
      },
      'open-list': {
        suggested_key: { default: 'Alt+Shift+P', mac: 'Alt+P' },
        description: 'Open Pteron in list view'
      }
    }
  },
  browser: 'chrome',
  browsers: {
    firefox: {}
  }
});

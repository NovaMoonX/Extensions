import { defineConfig } from 'wxt';

export default defineConfig({
  srcDir: 'src',
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'Leap',
    description: 'Leap — Instant Site Navigation, Notes & More',
    version: '2.0.0',
    permissions: ['storage', 'webNavigation', 'tabs'],
    host_permissions: ['<all_urls>'],
    omnibox: { keyword: 'lp' },
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
      'add-lily-pad': {
        suggested_key: { default: 'Ctrl+L', mac: 'Alt+L' },
        description: 'Add current page as Lily Pad'
      },
      'open-leaflets': {
        suggested_key: { default: 'Ctrl+Shift+L', mac: 'Alt+Shift+L' },
        description: 'Open Leaflets for current page'
      }
    }
  },
  browser: 'chrome',
  browsers: {
    firefox: {}
  }
});

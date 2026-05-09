export default function ShortcutHint() {
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  const modKey = isMac ? 'Option' : 'Ctrl';
  const primaryShortcut = `${modKey}+L`;
  const secondaryShortcut = isMac ? 'Option+Shift+L' : 'Ctrl+Shift+L';
  const listShortcut = isMac ? 'Option+P' : 'Alt+Shift+P';

  return (
    <div className="shortcut-hint">
      Tip: Press <kbd>{primaryShortcut}</kbd> to save · <kbd>{secondaryShortcut}</kbd> for Notes · <kbd>{listShortcut}</kbd> to open list
    </div>
  );
}

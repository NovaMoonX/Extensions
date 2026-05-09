export default function ShortcutHint() {
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  const modKey = isMac ? 'Option' : 'Ctrl';
  const primaryShortcut = `${modKey}+L`;
  const secondaryShortcut = isMac ? 'Option+Shift+L' : 'Ctrl+Shift+L';

  return (
    <div className="shortcut-hint">
      Tip: Press <kbd>{primaryShortcut}</kbd> to quickly save or open current page · <kbd>{secondaryShortcut}</kbd> for Notes
    </div>
  );
}

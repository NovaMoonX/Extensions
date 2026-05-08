export default function ShortcutHint() {
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  const modKey = isMac ? 'Option' : 'Ctrl';
  const primaryShortcut = `${modKey}+L`;
  const secondaryShortcut = `${modKey}+Shift+L`;

  return (
    <div className="shortcut-hint">
      Tip: Press <kbd>{primaryShortcut}</kbd> to quickly add or open current page · <kbd>{secondaryShortcut}</kbd> for Leaflets
    </div>
  );
}

import ViewHeader from '../ui/ViewHeader.jsx';

function getShortcuts() {
  const isMac = navigator.platform.toUpperCase().includes('MAC');
  const modKey = isMac ? 'Option' : 'Ctrl';

  return [
    { label: 'Save current page', key: `${modKey}+L` },
    { label: 'Open Notes for current page', key: isMac ? 'Option+Shift+L' : 'Ctrl+Shift+L' },
    { label: 'Open saved links list', key: isMac ? 'Option+P' : 'Alt+Shift+P' },
  ];
}

export default function ShortcutsView({ onBack }) {
  const shortcuts = getShortcuts();

  return (
    <div id="shortcutsView">
      <ViewHeader title="Keyboard Shortcuts" onBack={onBack} />
      <div className="shortcuts-screen">
        {shortcuts.map((shortcut) => (
          <div key={shortcut.label} className="shortcuts-screen__row">
            <span className="shortcuts-screen__key">{shortcut.key}</span>
            <span className="shortcuts-screen__separator">-</span>
            <span className="shortcuts-screen__description">{shortcut.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

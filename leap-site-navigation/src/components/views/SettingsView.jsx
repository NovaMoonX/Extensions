import React, { useState, useEffect } from 'react';
import { getSettings, saveSettings } from '../../utils/storage.js';
import ViewHeader from '../ui/ViewHeader.jsx';
import ToggleSwitch from '../ui/ToggleSwitch.jsx';

export default function SettingsView({ onBack, onExport, onImport }) {
  const [autoSuggestions, setAutoSuggestions] = useState(true);
  const [autoOpenLeaflets, setAutoOpenLeaflets] = useState(true);

  useEffect(() => {
    getSettings().then(s => {
      setAutoSuggestions(s.autoSuggestionsEnabled !== false);
      setAutoOpenLeaflets(s.autoOpenNotes !== false);
    });
  }, []);

  async function handleAutoSuggestionsChange(checked) {
    setAutoSuggestions(checked);
    const s = await getSettings();
    await saveSettings({ ...s, autoSuggestionsEnabled: checked });
  }

  async function handleAutoOpenLeafletsChange(checked) {
    setAutoOpenLeaflets(checked);
    const s = await getSettings();
    await saveSettings({ ...s, autoOpenNotes: checked });
  }

  return (
    <div id="settingsView">
      <ViewHeader title="Settings" onBack={onBack} />
      <div className="settings-list">
        <div className="setting-item">
          <div className="setting-info">
            <div className="setting-label">Auto Suggestions</div>
            <div className="setting-description">Automatically suggest adding a Lily Pad when you visit a page frequently</div>
          </div>
          <ToggleSwitch checked={autoSuggestions} onChange={handleAutoSuggestionsChange} />
        </div>
        <div className="setting-item">
          <div className="setting-info">
            <div className="setting-label">Auto-Open Leaflets</div>
            <div className="setting-description">Automatically open the Leaflets panel when you land on a page that has saved Leaflets</div>
          </div>
          <ToggleSwitch checked={autoOpenLeaflets} onChange={handleAutoOpenLeafletsChange} />
        </div>
        <div className="setting-item setting-item--action">
          <div className="setting-info">
            <div className="setting-label">Export Data</div>
            <div className="setting-description">Export all Lily Pads and Leaflets to a JSON file</div>
          </div>
          <button className="action-btn" onClick={onExport}>Export</button>
        </div>
        <div className="setting-item setting-item--action">
          <div className="setting-info">
            <div className="setting-label">Import Data</div>
            <div className="setting-description">Import Lily Pads and Leaflets from a JSON file</div>
          </div>
          <button className="action-btn" onClick={onImport}>Import</button>
        </div>
      </div>
    </div>
  );
}

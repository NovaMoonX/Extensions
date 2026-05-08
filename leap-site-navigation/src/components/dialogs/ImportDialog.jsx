import { useState } from 'react';
import { importData } from '../../utils/exportImport.js';

export default function ImportDialog({ onClose }) {
  const [overwrite, setOverwrite] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });
  const [file, setFile] = useState(null);

  async function handleImport() {
    if (!file) {
      setMessage({ text: 'Please select a file first.', type: 'error' });
      return;
    }
    try {
      const text = await file.text();
      const count = await importData(text, overwrite);
      setMessage({ text: `Imported ${count} item${count !== 1 ? 's' : ''} successfully.`, type: 'success' });
    } catch (err) {
      setMessage({ text: err.message || 'Import failed.', type: 'error' });
    }
  }

  return (
    <div className="dialog-overlay">
      <div className="dialog-box">
        <div className="dialog-header">
          <h3>Import Data</h3>
          <button className="dialog-close-btn" onClick={onClose}>✕</button>
        </div>
        <p className="dialog-hint">Select a previously exported Leap JSON file.</p>
        <input type="file" accept=".json,application/json" className="import-file-input"
          onChange={(e) => setFile(e.target.files[0] || null)} />
        <div className="overwrite-toggle">
          <input type="checkbox" id="overwriteToggle" checked={overwrite}
            onChange={(e) => setOverwrite(e.target.checked)} />
          <label htmlFor="overwriteToggle">Overwrite existing Lily Pads and Leaflets</label>
        </div>
        {message.text && (
          <div className={`message ${message.type}`}>{message.text}</div>
        )}
        <div className="dialog-actions">
          <button className="save" onClick={handleImport}>Import</button>
          <button className="cancel" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

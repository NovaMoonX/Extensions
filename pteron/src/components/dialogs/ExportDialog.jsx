import { useState, useEffect } from 'react';
import { exportData } from '../../utils/exportImport.js';

export default function ExportDialog({ onClose }) {
  const [json, setJson] = useState('');

  useEffect(() => {
    exportData().then(setJson);
  }, []);

  function handleDownload() {
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pteron-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="dialog-overlay">
      <div className="dialog-box">
        <div className="dialog-header">
          <h3>Export Data</h3>
          <button className="dialog-close-btn" onClick={onClose}>✕</button>
        </div>
        <p className="dialog-hint">Copy or download your links and notes as JSON.</p>
        <textarea className="export-textarea" readOnly value={json} />
        <div className="dialog-actions">
          <button className="save" onClick={handleDownload}>⬇ Download .json</button>
          <button className="cancel" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

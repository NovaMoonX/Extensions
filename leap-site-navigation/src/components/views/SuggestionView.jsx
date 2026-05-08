import React, { useState } from 'react';
import { saveLilyPad, getBlockedSuggestions, saveBlockedSuggestions } from '../../utils/storage.js';

export default function SuggestionView({ data, onCreated, onEdit, onCancel }) {
  const [saving, setSaving] = useState(false);

  async function handleCreate() {
    setSaving(true);
    try {
      await saveLilyPad(data.keyword, {
        url: data.url,
        description: data.description,
        timesUsed: 0,
        lastUsed: Date.now(),
      });
      await chrome.storage.session.remove('suggestedGoLink');
      onCreated();
    } finally {
      setSaving(false);
    }
  }

  async function handleBlock() {
    const blocked = await getBlockedSuggestions();
    if (!blocked.includes(data.url)) {
      await saveBlockedSuggestions([...blocked, data.url]);
    }
    await chrome.storage.session.remove('suggestedGoLink');
    window.close();
  }

  async function handleEdit() {
    await chrome.storage.session.remove('suggestedGoLink');
    onEdit(data);
  }

  return (
    <div id="suggestionView">
      <h2 id="suggestionTitle">Add to your Pond?</h2>
      <p className="suggestion-prompt">You've visited this page frequently. Add a Lily Pad for easy access?</p>

      <div className="suggestion-preview">
        <div className="preview-field">
          <label>Keyword</label>
          <div className="preview-value">{data.keyword}</div>
        </div>
        <div className="preview-field">
          <label>Description</label>
          <div className="preview-value">{data.description}</div>
        </div>
        <div className="preview-field">
          <label>URL</label>
          <div className="preview-value preview-url">{data.url}</div>
        </div>
      </div>

      <div className="button-group">
        <button className="create" onClick={handleCreate} disabled={saving}>Create</button>
        <button className="edit" onClick={handleEdit}>Edit</button>
        <button className="cancel" onClick={onCancel}>Cancel</button>
      </div>
      <button className="block-suggestion" onClick={handleBlock}>Don't suggest this again</button>
    </div>
  );
}

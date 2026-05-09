import React, { useState, useEffect } from 'react';
import { getTags, saveTags, getLinks, saveLink } from '../../utils/storage.js';
import ViewHeader from '../ui/ViewHeader.jsx';

export default function TagManagerView({ onBack }) {
  const [tags, setTags] = useState([]);
  const [newLabel, setNewLabel] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editingLabel, setEditingLabel] = useState('');

  useEffect(() => {
    getTags().then(setTags);
  }, []);

  async function handleCreate(e) {
    e.preventDefault();
    const label = newLabel.trim();
    if (!label) return;
    if (tags.some((t) => t.label.toLowerCase() === label.toLowerCase())) return;
    const newTag = { id: crypto.randomUUID(), label };
    const updated = [...tags, newTag];
    await saveTags(updated);
    setTags(updated);
    setNewLabel('');
  }

  async function handleDelete(id) {
    if (!confirm('Delete this tag? It will be removed from all links.')) return;
    const updated = tags.filter((t) => t.id !== id);
    await saveTags(updated);
    setTags(updated);
    // Remove deleted tag id from all links
    const links = await getLinks();
    for (const [keyword, data] of Object.entries(links)) {
      if (data.tagIds?.includes(id)) {
        await saveLink(keyword, { ...data, tagIds: data.tagIds.filter((tid) => tid !== id) });
      }
    }
  }

  async function handleRename(id) {
    const label = editingLabel.trim();
    if (!label) {
      setEditingId(null);
      return;
    }
    const updated = tags.map((t) => (t.id === id ? { ...t, label } : t));
    await saveTags(updated);
    setTags(updated);
    setEditingId(null);
    setEditingLabel('');
  }

  function startEdit(tag) {
    setEditingId(tag.id);
    setEditingLabel(tag.label);
  }

  return (
    <div id="tagManagerView">
      <ViewHeader title="Tag Manager" onBack={onBack} />

      <form onSubmit={handleCreate} className="tag-create-form">
        <input
          type="text"
          placeholder="New tag name…"
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          className="tag-create-input"
        />
        <button type="submit" className="tag-create-btn">Add</button>
      </form>

      {tags.length === 0 ? (
        <div className="empty-state" style={{ paddingTop: 24 }}>No tags yet. Create one above.</div>
      ) : (
        <div className="tag-list">
          {tags.map((tag) => (
            <div key={tag.id} className="tag-item">
              {editingId === tag.id ? (
                <form
                  onSubmit={(e) => { e.preventDefault(); handleRename(tag.id); }}
                  className="tag-edit-form"
                >
                  <input
                    autoFocus
                    type="text"
                    value={editingLabel}
                    onChange={(e) => setEditingLabel(e.target.value)}
                    className="tag-edit-input"
                  />
                  <button type="submit" className="tag-save-btn">Save</button>
                  <button type="button" className="tag-cancel-edit-btn" onClick={() => setEditingId(null)}>✕</button>
                </form>
              ) : (
                <>
                  <span className="tag-item-label">{tag.label}</span>
                  <div className="tag-item-actions">
                    <button className="tag-rename-btn" onClick={() => startEdit(tag)}>Rename</button>
                    <button className="tag-delete-btn" onClick={() => handleDelete(tag.id)}>Delete</button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

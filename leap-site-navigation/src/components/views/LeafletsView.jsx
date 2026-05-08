import React, { useState, useEffect, useRef } from 'react';
import { getLeaflet, saveLeaflet } from '../../utils/storage.js';
import ViewHeader from '../ui/ViewHeader.jsx';

export default function LeafletsView({ keyword, fromDetail, onBack, onCreateLilyPad }) {
  const [noteText, setNoteText] = useState('');
  const [editMode, setEditMode] = useState(false);
  const [draftText, setDraftText] = useState('');
  const textareaRef = useRef(null);

  useEffect(() => {
    if (keyword) {
      getLeaflet(keyword).then(text => {
        setNoteText(text);
        setEditMode(!text); // auto-enter edit if no existing note
        setDraftText(text);
        if (!text) setTimeout(() => textareaRef.current?.focus(), 0);
      });
    }
  }, [keyword]);

  async function handleSave() {
    const text = draftText.trim();
    await saveLeaflet(keyword, text);
    setNoteText(text);
    setEditMode(false);
  }

  function handleCancel() {
    if (noteText) {
      setDraftText(noteText);
      setEditMode(false);
    } else {
      onBack(keyword, fromDetail);
    }
  }

  function handleEdit() {
    setDraftText(noteText);
    setEditMode(true);
    setTimeout(() => textareaRef.current?.focus(), 0);
  }

  return (
    <div id="notesView">
      <ViewHeader title="Leaflets" onBack={() => onBack(keyword, fromDetail)} />

      {!keyword ? (
        <div id="noQuickLinkPrompt">
          <div className="notes-no-link">
            <div className="notes-no-link-icon">🍃</div>
            <p>No Lily Pad found for this page.</p>
            <p className="notes-hint">Add a Lily Pad first, then you can add Leaflets to it.</p>
            <button className="save" onClick={onCreateLilyPad}>Add Lily Pad</button>
          </div>
        </div>
      ) : (
        <div id="notesContent">
          <div id="notesKeywordLabel" className="notes-keyword-label">{keyword}</div>

          {!editMode ? (
            <div id="notesViewMode">
              <div className={`notes-text-display ${!noteText ? 'empty' : ''}`}>
                {noteText || 'No leaflets yet.'}
              </div>
              <button className="edit-note-action" onClick={handleEdit}>✏️ Edit Leaflet</button>
            </div>
          ) : (
            <div id="notesEditMode">
              <textarea
                ref={textareaRef}
                className="note-textarea"
                placeholder="Write your leaflets here..."
                value={draftText}
                onChange={(e) => setDraftText(e.target.value)}
              />
              <div className="button-group">
                <button className="save" onClick={handleSave}>Save</button>
                <button className="cancel" onClick={handleCancel}>Cancel</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

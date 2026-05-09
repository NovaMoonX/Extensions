import React, { useState, useEffect, useRef } from 'react';
import { getNote, saveNote } from '../../utils/storage.js';
import ViewHeader from '../ui/ViewHeader.jsx';

export default function NotesView({ keyword, fromDetail, onBack, onCreateLink }) {
  const [noteText, setNoteText] = useState('');
  const [editMode, setEditMode] = useState(false);
  const [draftText, setDraftText] = useState('');
  const textareaRef = useRef(null);

  useEffect(() => {
    if (keyword) {
      getNote(keyword).then(text => {
        setNoteText(text);
        setEditMode(!text); // auto-enter edit if no existing note
        setDraftText(text);
        if (!text) setTimeout(() => textareaRef.current?.focus(), 0);
      });
    }
  }, [keyword]);

  async function handleSave() {
    const text = draftText.trim();
    await saveNote(keyword, text);
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
      <ViewHeader title="Notes" onBack={() => onBack(keyword, fromDetail)} />

      {!keyword ? (
        <div id="noQuickLinkPrompt">
          <div className="notes-no-link">
            <div className="notes-no-link-icon">📝</div>
            <p>No link saved for this page.</p>
            <p className="notes-hint">Save a link for this page first, then you can attach Notes to it.</p>
            <button className="save" onClick={onCreateLink}>Save Link</button>
          </div>
        </div>
      ) : (
        <div id="notesContent">
          <div id="notesKeywordLabel" className="notes-keyword-label">{keyword}</div>

          {!editMode ? (
            <div id="notesViewMode">
              <div className={`notes-text-display ${!noteText ? 'empty' : ''}`}>
                {noteText || 'No notes yet.'}
              </div>
              <button className="edit-note-action" onClick={handleEdit}>✏️ Edit Note</button>
            </div>
          ) : (
            <div id="notesEditMode">
              <textarea
                ref={textareaRef}
                className="note-textarea"
                placeholder="Write your notes here..."
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

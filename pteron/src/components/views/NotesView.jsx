import React, { useState, useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import { getNote, saveNote } from '../../utils/storage.js';
import ViewHeader from '../ui/ViewHeader.jsx';
import { FileText, Pencil, Bold, Italic, Underline as UnderlineIcon, Strikethrough, List, ListOrdered, Link2, Unlink2 } from '../ui/Icons.jsx';

function isHtml(str) {
  return typeof str === 'string' && str.trim().startsWith('<');
}

function plainToHtml(text) {
  return text
    .split('\n')
    .map(line => `<p>${line || '<br>'}</p>`)
    .join('');
}

export default function NotesView({ keyword, fromDetail, onBack, onCreateLink }) {
  const [savedContent, setSavedContent] = useState('');
  const [editMode, setEditMode] = useState(false);
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Link.configure({ openOnClick: false }),
    ],
    content: '',
    editable: false,
  });

  useEffect(() => {
    if (keyword && editor) {
      getNote(keyword).then(text => {
        const html = text ? (isHtml(text) ? text : plainToHtml(text)) : '';
        setSavedContent(html);
        editor.commands.setContent(html || '');
        const isEmpty = !text;
        setEditMode(isEmpty);
        editor.setEditable(isEmpty);
        if (isEmpty) setTimeout(() => editor.commands.focus(), 0);
      });
    }
  }, [keyword, editor]);

  useEffect(() => {
    if (editor) editor.setEditable(editMode);
  }, [editor, editMode]);

  async function handleSave() {
    const html = editor.getHTML();
    const isEmpty = html === '<p></p>' || html === '';
    const toStore = isEmpty ? '' : html;
    await saveNote(keyword, toStore);
    setSavedContent(toStore);
    setEditMode(false);
    setShowLinkInput(false);
  }

  function handleCancel() {
    if (savedContent) {
      editor.commands.setContent(savedContent);
      setEditMode(false);
      setShowLinkInput(false);
    } else {
      onBack(keyword, fromDetail);
    }
  }

  function handleEdit() {
    setEditMode(true);
    setTimeout(() => editor.commands.focus(), 0);
  }

  function handleLinkButton() {
    if (editor.isActive('link')) {
      editor.chain().focus().unsetLink().run();
      setShowLinkInput(false);
    } else {
      setLinkUrl(editor.getAttributes('link').href || '');
      setShowLinkInput(v => !v);
    }
  }

  function applyLink() {
    if (!linkUrl.trim()) {
      editor.chain().focus().unsetLink().run();
    } else {
      const href = /^https?:\/\//i.test(linkUrl) ? linkUrl : `https://${linkUrl}`;
      editor.chain().focus().setLink({ href }).run();
    }
    setShowLinkInput(false);
    setLinkUrl('');
  }

  return (
    <div id="notesView">
      <ViewHeader title="Notes" onBack={() => onBack(keyword, fromDetail)} />

      {!keyword ? (
        <div id="noQuickLinkPrompt">
          <div className="notes-no-link">
            <div className="notes-no-link-icon">
              <FileText size={36} strokeWidth={1.5} color="#64748B" />
            </div>
            <p>No link saved for this page.</p>
            <p className="notes-hint">Save a link for this page first, then you can attach Notes to it.</p>
            <button className="save" onClick={onCreateLink}>Save Link</button>
          </div>
        </div>
      ) : (
        <div id="notesContent">
          <div id="notesKeywordLabel" className="notes-keyword-label">{keyword}</div>

          {editMode && (
            <div className="rich-text-toolbar">
              <button
                type="button"
                className={`toolbar-btn${editor?.isActive('bold') ? ' is-active' : ''}`}
                title="Bold"
                onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleBold().run(); }}
              >
                <Bold size={13} strokeWidth={2.5} />
              </button>
              <button
                type="button"
                className={`toolbar-btn${editor?.isActive('italic') ? ' is-active' : ''}`}
                title="Italic"
                onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleItalic().run(); }}
              >
                <Italic size={13} strokeWidth={2} />
              </button>
              <button
                type="button"
                className={`toolbar-btn${editor?.isActive('underline') ? ' is-active' : ''}`}
                title="Underline"
                onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleUnderline().run(); }}
              >
                <UnderlineIcon size={13} strokeWidth={2} />
              </button>
              <button
                type="button"
                className={`toolbar-btn${editor?.isActive('strike') ? ' is-active' : ''}`}
                title="Strikethrough"
                onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleStrike().run(); }}
              >
                <Strikethrough size={13} strokeWidth={2} />
              </button>
              <div className="toolbar-divider" />
              <button
                type="button"
                className={`toolbar-btn${editor?.isActive('bulletList') ? ' is-active' : ''}`}
                title="Bullet list"
                onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleBulletList().run(); }}
              >
                <List size={13} strokeWidth={2} />
              </button>
              <button
                type="button"
                className={`toolbar-btn${editor?.isActive('orderedList') ? ' is-active' : ''}`}
                title="Numbered list"
                onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleOrderedList().run(); }}
              >
                <ListOrdered size={13} strokeWidth={2} />
              </button>
              <div className="toolbar-divider" />
              <button
                type="button"
                className={`toolbar-btn${editor?.isActive('link') ? ' is-active' : ''}`}
                title={editor?.isActive('link') ? 'Remove link' : 'Add link'}
                onMouseDown={(e) => { e.preventDefault(); handleLinkButton(); }}
              >
                {editor?.isActive('link') ? <Unlink2 size={13} strokeWidth={2} /> : <Link2 size={13} strokeWidth={2} />}
              </button>
            </div>
          )}

          {editMode && showLinkInput && (
            <div className="link-input-bar">
              <input
                className="link-input"
                type="url"
                placeholder="https://example.com"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); applyLink(); } }}
                autoFocus
              />
              <button type="button" className="link-apply-btn" onClick={applyLink}>Apply</button>
            </div>
          )}

          <div className={`notes-editor-wrapper${!editMode ? ' notes-editor-readonly' : ' notes-editor-wrapper--editable'}`}>
            {!editMode && !savedContent ? (
              <div className="notes-text-display empty">No notes yet.</div>
            ) : (
              <EditorContent editor={editor} className="notes-editor" />
            )}
          </div>

          {!editMode ? (
            <button className="edit-note-action" onClick={handleEdit}>
              <Pencil size={13} strokeWidth={2} style={{ verticalAlign: 'middle', marginRight: 6 }} />Edit Note
            </button>
          ) : (
            <div className="button-group">
              <button className="save" onClick={handleSave}>Save</button>
              <button className="cancel" onClick={handleCancel}>Cancel</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}


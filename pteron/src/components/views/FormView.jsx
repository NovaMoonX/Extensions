import { useState, useEffect, useRef } from 'react';
import { saveLink, deleteLink, getLink, keywordExists } from '../../utils/storage.js';
import { extractSuggestionFieldsFromTitle, stripQueryParams } from '../../utils/url.js';
import ShortcutHint from '../ui/ShortcutHint.jsx';
import { FileText } from '../ui/Icons.jsx';

async function getKeywordError(keyword, editingKeyword) {
  if (keyword.startsWith('__')) {
    return "Keywords cannot begin with '__' — that prefix is reserved for internal use.";
  }
  if (keyword && keyword !== editingKeyword) {
    const exists = await keywordExists(keyword);
    if (exists) return 'A link with this keyword already exists.';
  }
  return null;
}

export default function FormView({ editingKeyword, prefillData, pendingUrl, pendingTitle, onSaved, onCancel, onViewNotes, onViewAll }) {
  const [url, setUrl] = useState('');
  const [keyword, setKeyword] = useState('');
  const [description, setDescription] = useState('');
  const [stripParams, setStripParams] = useState(false);
  const [keywordWarning, setKeywordWarning] = useState('');
  const [message, setMessage] = useState({ text: '', type: '' });
  const [originalUrlWithParams, setOriginalUrlWithParams] = useState(null);
  const descRef = useRef(null);
  const keywordRef = useRef(null);

  const isEdit = !!editingKeyword;

  useEffect(() => {
    async function initForm() {
      if (editingKeyword) {
        const pad = await getLink(editingKeyword);
        if (pad) {
          setUrl(pad.url);
          setKeyword(editingKeyword);
          setDescription(pad.description || '');
        }
        setTimeout(() => descRef.current?.focus(), 0);
      } else if (prefillData) {
        setUrl(prefillData.url || '');
        setKeyword(prefillData.keyword || '');
        setDescription(prefillData.description || '');
        validateKeyword(prefillData.keyword || '', null);
        setTimeout(() => keywordRef.current?.focus(), 0);
      } else if (pendingUrl) {
        const { url: u, keyword: k, description: d, originalUrl } = extractSuggestionFieldsFromTitle(pendingTitle || '', pendingUrl);
        setOriginalUrlWithParams(originalUrl || pendingUrl);
        setUrl(originalUrl || pendingUrl);
        setKeyword(k);
        setDescription(d);
        validateKeyword(k, null);
        setTimeout(() => descRef.current?.focus(), 0);
      } else {
        // New blank form — pre-fill from current tab
        try {
          const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
          if (tabs[0]?.url) {
            const { url: u, keyword: k, description: d, originalUrl } = extractSuggestionFieldsFromTitle(tabs[0].title || '', tabs[0].url);
            setOriginalUrlWithParams(originalUrl || tabs[0].url);
            setUrl(originalUrl || tabs[0].url);
            setKeyword(k);
            setDescription(d);
            validateKeyword(k, null);
          }
        } catch {}
        setTimeout(() => keywordRef.current?.focus(), 0);
      }
    }
    initForm();
  }, [editingKeyword, prefillData, pendingUrl, pendingTitle, descRef, keywordRef]);

  async function validateKeyword(kw, editing) {
    const trimmed = kw.trim().toLowerCase();
    if (!trimmed) { setKeywordWarning(''); return; }
    const err = await getKeywordError(trimmed, editing ?? editingKeyword);
    setKeywordWarning(err || '');
  }

  function handleUrlChange(e) {
    setUrl(e.target.value);
    setOriginalUrlWithParams(null);
  }

  function handleStripToggle(checked) {
    setStripParams(checked);
    if (checked) {
      setUrl(stripQueryParams(url));
    } else if (originalUrlWithParams) {
      setUrl(originalUrlWithParams);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const kw = keyword.trim().toLowerCase();
    const u = url.trim();
    const desc = description.trim();

    if (!kw || !u) {
      setMessage({ text: 'Keyword and URL are required', type: 'error' });
      return;
    }

    const err = await getKeywordError(kw, editingKeyword);
    if (err) { setMessage({ text: err, type: 'error' }); return; }

    try {
      if (editingKeyword && editingKeyword !== kw) {
        await deleteLink(editingKeyword);
      }
      const existing = await getLink(kw);
      await saveLink(kw, {
        url: u,
        description: desc || kw,
        timesUsed: existing?.timesUsed || 0,
        lastUsed: existing?.lastUsed || Date.now(),
      });
      await chrome.storage.session.remove('pendingUrl');
      setMessage({ text: isEdit ? 'Link updated!' : 'Link saved!', type: 'success' });
      setTimeout(() => { onSaved(); }, 750);
    } catch {
      setMessage({ text: 'Error saving link', type: 'error' });
    }
  }

  async function handleDelete() {
    if (!editingKeyword) return;
    if (!confirm(`Delete your link "${editingKeyword}"?`)) return;
    await deleteLink(editingKeyword);
    onCancel();
  }

  function handleCancel() {
    chrome.storage.session.get('pendingUrl').then(({ pendingUrl: pu }) => {
      if (pu) { chrome.storage.session.remove('pendingUrl'); window.close(); }
      else { onCancel(); }
    });
  }

  return (
    <div id="formView">
      <h2 id="formTitle">{isEdit ? 'Edit Link' : 'Save New Link'}</h2>

      {message.text && (
        <div className={`message ${message.type}`}>{message.text}</div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="url">URL</label>
          <input id="url" type="text" required value={url}
            onChange={handleUrlChange} />
          {!isEdit && (
            <div className="toggle-group">
              <input type="checkbox" id="stripQueryParamsToggle" checked={stripParams}
                onChange={(e) => handleStripToggle(e.target.checked)} />
              <label htmlFor="stripQueryParamsToggle">Exclude query parameters</label>
            </div>
          )}
        </div>

        <div className="form-group">
          <label htmlFor="keyword">Keyword <span style={{ color: '#666' }}>(required)</span></label>
          <input id="keyword" ref={keywordRef} type="text" required placeholder="e.g., myapp"
            value={keyword}
            onChange={(e) => { setKeyword(e.target.value); validateKeyword(e.target.value, editingKeyword); }} />
          {keywordWarning && (
            <div className="keyword-warning">{keywordWarning}</div>
          )}
        </div>

        <div className="form-group">
          <label htmlFor="description">Description <span style={{ color: '#999' }}>(optional)</span></label>
          <input id="description" ref={descRef} type="text" placeholder="e.g., Open My App"
            value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>

        <div className="button-group">
          <button type="submit" className="save">{isEdit ? 'Update' : 'Save'}</button>
          <button type="button" className="cancel" onClick={handleCancel}>Cancel</button>
        </div>
        {isEdit && (
          <button type="button" className="delete-link" onClick={handleDelete}>Delete This Link</button>
        )}
      </form>

      {isEdit && editingKeyword && (
      <button type="button" className="form-notes-btn" onClick={() => onViewNotes(editingKeyword)}>
          <FileText size={14} strokeWidth={2} style={{ verticalAlign: 'middle', marginRight: 6 }} />View / Edit Notes
        </button>
      )}

      <button className="view-all" onClick={onViewAll}>View All Links</button>
      <ShortcutHint />
    </div>
  );
}

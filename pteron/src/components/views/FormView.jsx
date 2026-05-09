import { useState, useEffect, useRef } from 'react';
import { saveLink, deleteLink, getLink, keywordExists, getTags, saveTags } from '../../utils/storage.js';
import { extractSuggestionFieldsFromTitle, stripQueryParams } from '../../utils/url.js';
import { useAIEnhancement } from '../../hooks/useAIEnhancement';
import { FileText, Trash2, Plus, Check, X } from '../ui/Icons.jsx';

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

export default function FormView({ editingKeyword, prefillData, pendingUrl, pendingTitle, onSaved, onCancel, onViewNotes, onViewAll, onViewShortcuts }) {
  const [url, setUrl] = useState('');
  const [keyword, setKeyword] = useState('');
  const [description, setDescription] = useState('');
  const [stripParams, setStripParams] = useState(false);
  const [keywordWarning, setKeywordWarning] = useState('');
  const [message, setMessage] = useState({ text: '', type: '' });
  const [originalUrlWithParams, setOriginalUrlWithParams] = useState(null);
  const [availableTags, setAvailableTags] = useState([]);
  const [selectedTagIds, setSelectedTagIds] = useState([]);
  const [newTagLabel, setNewTagLabel] = useState('');
  const [showNewTagInput, setShowNewTagInput] = useState(false);
  const [newTagError, setNewTagError] = useState('');

  const descRef = useRef(null);
  const keywordRef = useRef(null);
  const newTagRef = useRef(null);

  const isEdit = !!editingKeyword;

  // AI enhancement (suggestions only — nothing is applied automatically)
  const { aiPhase, modelProgress, pendingSuggestions, dismissKeyword, dismissDescription, dismissTag } =
    useAIEnhancement(!isEdit && !prefillData, availableTags, pendingTitle || undefined);

  useEffect(() => {
    getTags().then(setAvailableTags);
  }, []);

  useEffect(() => {
    async function initForm() {
      if (editingKeyword) {
        const pad = await getLink(editingKeyword);
        if (pad) {
          setUrl(pad.url);
          setKeyword(editingKeyword);
          setDescription(pad.description || '');
          setSelectedTagIds(pad.tagIds || []);
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
        tagIds: selectedTagIds,
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

  async function handleCreateTag(e) {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    const label = newTagLabel.trim();
    if (!label) { setNewTagError('Tag name cannot be empty.'); return; }
    if (availableTags.some((t) => t.label.toLowerCase() === label.toLowerCase())) {
      setNewTagError('A tag with this name already exists.');
      return;
    }
    setNewTagError('');
    const newTag = { id: crypto.randomUUID(), label };
    const updated = [...availableTags, newTag];
    await saveTags(updated);
    setAvailableTags(updated);
    setSelectedTagIds([...selectedTagIds, newTag.id]);
    setNewTagLabel('');
    setShowNewTagInput(false);
  }

  function handleToggleNewTagInput() {
    setShowNewTagInput((v) => !v);
    setNewTagError('');
    setNewTagLabel('');
    if (!showNewTagInput) {
      setTimeout(() => newTagRef.current?.focus(), 0);
    }
  }

  async function handleAcceptAITag(suggestion) {
    if (suggestion.isNew) {
      // Create the new tag in storage before selecting it
      const newTag = { id: crypto.randomUUID(), label: suggestion.label };
      const updated = [...availableTags, newTag];
      await saveTags(updated);
      setAvailableTags(updated);
      setSelectedTagIds((prev) => [...prev, newTag.id]);
    } else {
      setSelectedTagIds((prev) =>
        prev.includes(suggestion.existingId) ? prev : [...prev, suggestion.existingId]
      );
    }
    dismissTag(suggestion.tempId);
  }

  return (
    <div id="formView">
      <div className="form-title-row">
        <h2 id="formTitle">{isEdit ? 'Edit Link' : 'Save New Link'}</h2>
        {isEdit && (
          <button type="button" className="form-delete-icon-btn" title="Delete this link" onClick={handleDelete}>
            <Trash2 size={16} strokeWidth={2} />
          </button>
        )}
      </div>

      {/* AI model initialization banner — shown while engine loads from cache */}
      {aiPhase === 'initializing' && (
        <div className="ai-init-banner">
          <span className="ai-init-label">🪶 Initializing Wings…</span>
          <div className="ai-init-progress">
            <div
              className="ai-init-fill"
              style={{ width: `${Math.round(modelProgress * 100)}%` }}
            />
          </div>
        </div>
      )}

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

        {/* Stage 2: keyword + description — pulsing while AI is working */}
        <div className={`form-group${aiPhase === 'stage2' ? ' ai-field--thinking' : ''}`}>
          <label htmlFor="keyword">
            Keyword
            {aiPhase === 'stage2' && <span className="ai-thinking-dots" aria-label="AI thinking" />}
          </label>
          <input id="keyword" ref={keywordRef} type="text" required placeholder="e.g., myapp"
            value={keyword}
            onChange={(e) => { setKeyword(e.target.value); validateKeyword(e.target.value, editingKeyword); }} />
          {keywordWarning && (
            <div className="keyword-warning">{keywordWarning}</div>
          )}
          {pendingSuggestions.keyword && (
            <div className="ai-suggestion">
              <span className="ai-suggestion-label">🪶 AI suggests:</span>
              <code className="ai-suggestion-value">{pendingSuggestions.keyword}</code>
              <button
                type="button"
                className="ai-suggestion-accept"
                title="Use this keyword"
                onClick={() => { setKeyword(pendingSuggestions.keyword); validateKeyword(pendingSuggestions.keyword, editingKeyword); dismissKeyword(); }}
              >
                <Check size={12} strokeWidth={2.5} /> Use
              </button>
              <button
                type="button"
                className="ai-suggestion-dismiss"
                title="Dismiss suggestion"
                onClick={dismissKeyword}
              >
                <X size={12} strokeWidth={2.5} />
              </button>
            </div>
          )}
        </div>

        <div className={`form-group${aiPhase === 'stage2' ? ' ai-field--thinking' : ''}`}>
          <label htmlFor="description">
            Description <span style={{ color: '#999' }}>(optional)</span>
            {aiPhase === 'stage2' && <span className="ai-thinking-dots" aria-label="AI thinking" />}
          </label>
          <input id="description" ref={descRef} type="text" placeholder="e.g., Open My App"
            value={description} onChange={(e) => setDescription(e.target.value)} />
          {pendingSuggestions.description && (
            <div className="ai-suggestion">
              <span className="ai-suggestion-label">🪶 AI suggests:</span>
              <span className="ai-suggestion-value">{pendingSuggestions.description}</span>
              <button
                type="button"
                className="ai-suggestion-accept"
                title="Use this description"
                onClick={() => { setDescription(pendingSuggestions.description); dismissDescription(); }}
              >
                <Check size={12} strokeWidth={2.5} /> Use
              </button>
              <button
                type="button"
                className="ai-suggestion-dismiss"
                title="Dismiss suggestion"
                onClick={dismissDescription}
              >
                <X size={12} strokeWidth={2.5} />
              </button>
            </div>
          )}
        </div>

        {/* Stage 3: tags — thinking state while AI suggests */}
        <div className={`form-group${aiPhase === 'stage3' ? ' ai-field--thinking' : ''}`}>
          <div className="tag-section-header">
            <label style={{ margin: 0 }}>
              Tags
              {aiPhase === 'stage3' && <span className="ai-thinking-dots" aria-label="AI thinking" />}
            </label>
            <button
              type="button"
              className="tag-add-inline-btn"
              onClick={handleToggleNewTagInput}
              title="Create new tag"
            >
              <Plus size={13} strokeWidth={2.5} />
              New tag
            </button>
          </div>

          {/* AI tag suggestions — user approves or dismisses each one */}
          {pendingSuggestions.tags && pendingSuggestions.tags.length > 0 && (
            <div className="ai-tag-suggestions">
              <span className="ai-suggestion-label">🪶 AI suggests:</span>
              <div className="ai-tag-suggestion-chips">
                {pendingSuggestions.tags.map((s) => (
                  <span key={s.tempId} className="ai-tag-suggestion-chip">
                    <span className="ai-tag-suggestion-label">
                      {s.isNew && <span className="ai-tag-new-badge">new</span>}
                      {s.label}
                    </span>
                    <button
                      type="button"
                      className="ai-tag-accept-btn"
                      title={`Add tag "${s.label}"`}
                      onClick={() => handleAcceptAITag(s)}
                    >
                      <Check size={11} strokeWidth={2.5} />
                    </button>
                    <button
                      type="button"
                      className="ai-tag-dismiss-btn"
                      title="Dismiss"
                      onClick={() => dismissTag(s.tempId)}
                    >
                      <X size={11} strokeWidth={2.5} />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}

          {showNewTagInput && (
            <div className="tag-inline-create-form" role="group" aria-label="Create new tag">
              <input
                ref={newTagRef}
                type="text"
                placeholder="Tag name…"
                value={newTagLabel}
                onChange={(e) => { setNewTagLabel(e.target.value); setNewTagError(''); }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleCreateTag(e);
                  }
                }}
                className="tag-inline-create-input"
              />
              <button type="button" className="tag-save-btn" onClick={handleCreateTag}>Add</button>
              <button type="button" className="tag-cancel-edit-btn" onClick={() => { setShowNewTagInput(false); setNewTagError(''); }}>✕</button>
            </div>
          )}
          {newTagError && <div className="keyword-warning" style={{ marginTop: 4 }}>{newTagError}</div>}

          {availableTags.length > 0 && (
            <div className="tag-selector">
              {availableTags.map((tag) => {
                const active = selectedTagIds.includes(tag.id);
                return (
                  <button
                    key={tag.id}
                    type="button"
                    className={`tag-chip${active ? ' tag-chip--active' : ''}`}
                    onClick={() =>
                      setSelectedTagIds(
                        active
                          ? selectedTagIds.filter((id) => id !== tag.id)
                          : [...selectedTagIds, tag.id]
                      )
                    }
                  >
                    {tag.label}
                  </button>
                );
              })}
            </div>
          )}

          {availableTags.length === 0 && !showNewTagInput && (
            <div className="tag-empty-hint">No tags yet — click "+ New tag" to create one.</div>
          )}
        </div>

        <div className="button-group">
          <button type="submit" className="save">{isEdit ? 'Update' : 'Save'}</button>
          <button type="button" className="cancel" onClick={handleCancel}>Cancel</button>
        </div>
      </form>

      {isEdit && editingKeyword && (
      <button type="button" className="form-notes-btn" onClick={() => onViewNotes(editingKeyword)}>
          <FileText size={14} strokeWidth={2} style={{ verticalAlign: 'middle', marginRight: 6 }} />View / Edit Notes
        </button>
      )}

      <button className="view-all" onClick={onViewAll}>View All Links</button>
      <div className="shortcut-hint">
        <button type="button" className="shortcut-link-btn" onClick={onViewShortcuts}>
          View keyboard shortcuts
        </button>
      </div>
    </div>
  );
}


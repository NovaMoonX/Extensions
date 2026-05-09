import React, { useState, useEffect, useCallback } from 'react';
import { getLinks, getBlockedSuggestions } from '../../utils/storage.js';
import ShortcutHint from '../ui/ShortcutHint.jsx';

function fuzzyMatch(keyword, searchTerm) {
  let searchIdx = 0;
  for (let keyIdx = 0; keyIdx < keyword.length && searchIdx < searchTerm.length; keyIdx++) {
    if (keyword[keyIdx] === searchTerm[searchIdx]) searchIdx++;
  }
  return searchIdx === searchTerm.length;
}

export default function ListView({ onAddNew, onEditItem, onViewDetail, onViewBlocked, onSettings }) {
  const [pads, setPads] = useState({});
  const [search, setSearch] = useState('');
  const [blockedCount, setBlockedCount] = useState(0);
  const [copiedKeyword, setCopiedKeyword] = useState(null);

  const reload = useCallback(async () => {
    const [p, b] = await Promise.all([getLinks(), getBlockedSuggestions()]);
    setPads(p);
    setBlockedCount(b.length);
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const filtered = (() => {
    const keys = Object.keys(pads);
    if (!search) return keys;
    const s = search.toLowerCase();
    const sub = keys.filter(k =>
      k.toLowerCase().includes(s) ||
      pads[k].description?.toLowerCase().includes(s) ||
      pads[k].url?.toLowerCase().includes(s)
    );
    const fuzzy = keys.filter(k => !sub.includes(k) && fuzzyMatch(k.toLowerCase(), s));
    return [...sub, ...fuzzy];
  })();

  async function handleCopy(e, url) {
    e.stopPropagation();
    await navigator.clipboard.writeText(url);
    const kw = e.currentTarget.dataset.keyword;
    setCopiedKeyword(kw);
    setTimeout(() => setCopiedKeyword(null), 1500);
  }

  return (
    <div id="listView">
      <div className="list-header">
        <h2>Saved Links</h2>
        <button className="add-new" onClick={onAddNew}>+ Add New</button>
      </div>

      <div className="search-container">
        <input
          autoFocus
          type="text"
          id="searchInput"
          placeholder="Search links..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="suggestions-list">
        {Object.keys(pads).length === 0 ? (
          <div className="empty-state">No saved links yet.<br />Type p/ in the address bar to add one!</div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">No matching links found.</div>
        ) : filtered.map((keyword) => {
          const pad = pads[keyword];
          return (
            <div key={keyword} className="suggestion-item" onClick={() => onViewDetail(keyword)}>
              <div className="suggestion-header">
                <a href={pad.url} target="_blank" rel="noreferrer" className="suggestion-keyword"
                  onClick={(e) => e.stopPropagation()}>
                  {keyword}
                </a>
                <div className="suggestion-actions">
                  <button className="edit-btn" data-keyword={keyword}
                    onClick={(e) => { e.stopPropagation(); onEditItem(keyword); }}>
                    Edit
                  </button>
                  <button className="copy-btn" data-keyword={keyword}
                    onClick={(e) => handleCopy(e, pad.url)}>
                    {copiedKeyword === keyword ? 'Copied!' : 'Copy URL'}
                  </button>
                </div>
              </div>
              <div className="suggestion-description">{pad.description || keyword}</div>
              <div className="suggestion-url">{pad.url}</div>
            </div>
          );
        })}
      </div>

      <div className="list-footer">
        {blockedCount > 0 && (
          <button className="footer-btn" onClick={onViewBlocked}>Blocked ({blockedCount})</button>
        )}
        <button className="footer-btn" onClick={onSettings}>⚙ Settings</button>
      </div>

      <ShortcutHint />
    </div>
  );
}

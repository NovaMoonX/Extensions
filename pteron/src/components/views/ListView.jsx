import React, { useState, useEffect, useCallback } from 'react';
import { getLinks, getBlockedSuggestions, getTags } from '../../utils/storage.js';
import ShortcutHint from '../ui/ShortcutHint.jsx';
import { Copy, Check, Settings, ChevronDown, ChevronUp } from '../ui/Icons.jsx';

function fuzzyMatch(keyword, searchTerm) {
  let searchIdx = 0;
  for (let keyIdx = 0; keyIdx < keyword.length && searchIdx < searchTerm.length; keyIdx++) {
    if (keyword[keyIdx] === searchTerm[searchIdx]) searchIdx++;
  }
  return searchIdx === searchTerm.length;
}

const TAG_CHAR_LIMIT = 30;

export default function ListView({ onAddNew, onEditItem, onViewDetail, onViewBlocked, onSettings }) {
  const [pads, setPads] = useState({});
  const [search, setSearch] = useState('');
  const [blockedCount, setBlockedCount] = useState(0);
  const [copiedKeyword, setCopiedKeyword] = useState(null);
  const [tags, setTags] = useState([]);
  const [activeTagIds, setActiveTagIds] = useState([]);
  const [tagsExpanded, setTagsExpanded] = useState(false);

  const reload = useCallback(async () => {
    const [p, b, t] = await Promise.all([getLinks(), getBlockedSuggestions(), getTags()]);
    setPads(p);
    setBlockedCount(b.length);
    setTags(t);
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const filtered = (() => {
    const keys = Object.keys(pads);
    // Tag filter: if any tag is selected, only show links that have at least one
    const tagFiltered = activeTagIds.length === 0
      ? keys
      : keys.filter((k) => pads[k].tagIds?.some((id) => activeTagIds.includes(id)));

    if (!search) return tagFiltered;
    const s = search.toLowerCase();
    const sub = tagFiltered.filter(k =>
      k.toLowerCase().includes(s) ||
      pads[k].description?.toLowerCase().includes(s) ||
      pads[k].url?.toLowerCase().includes(s)
    );
    const fuzzy = tagFiltered.filter(k => !sub.includes(k) && fuzzyMatch(k.toLowerCase(), s));
    return [...sub, ...fuzzy];
  })();

  async function handleCopy(e, url) {
    e.stopPropagation();
    await navigator.clipboard.writeText(url);
    const kw = e.currentTarget.dataset.keyword;
    setCopiedKeyword(kw);
    setTimeout(() => setCopiedKeyword(null), 1500);
  }

  const collapsedCount = (() => {
    let chars = 0;
    let count = 0;
    for (const tag of tags) {
      if (count === 0 || chars + tag.label.length <= TAG_CHAR_LIMIT) {
        chars += tag.label.length;
        count++;
      } else {
        break;
      }
    }
    return count;
  })();
  const visibleTags = tagsExpanded ? tags : tags.slice(0, collapsedCount);
  const hasMoreTags = tags.length > collapsedCount;

  return (
    <div id="listView">
      <div className="list-header">
        <div className="brand-mark">
          <img src="/icons/logo-light-bg.svg" alt="Pteron" className="brand-logo brand-logo--light" />
          <img src="/icons/logo-dark-bg.svg" alt="Pteron" className="brand-logo brand-logo--dark" />
        </div>
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

      {tags.length > 0 && (
        <div className="tag-filter-section">
          <div className={`tag-filter-bar${tagsExpanded ? ' tag-filter-bar--expanded' : ''}`}>
            {visibleTags.map((tag) => {
              const active = activeTagIds.includes(tag.id);
              return (
                <button
                  key={tag.id}
                  className={`tag-chip${active ? ' tag-chip--active' : ''}`}
                  onClick={() =>
                    setActiveTagIds(
                      active
                        ? activeTagIds.filter((id) => id !== tag.id)
                        : [...activeTagIds, tag.id]
                    )
                  }
                >
                  {tag.label}
                </button>
              );
            })}
          </div>
          {hasMoreTags && (
            <button
              className="tag-filter-toggle"
              onClick={() => setTagsExpanded((v) => !v)}
            >
              {tagsExpanded ? (
                <><ChevronUp size={12} strokeWidth={2.5} style={{ verticalAlign: 'middle', marginRight: 3 }} />Show less</>
              ) : (
                <><ChevronDown size={12} strokeWidth={2.5} style={{ verticalAlign: 'middle', marginRight: 3 }} />+{tags.length - collapsedCount} more</>
              )}
            </button>
          )}
        </div>
      )}

      <div className="suggestions-list">
        {Object.keys(pads).length === 0 ? (
          <div className="empty-state">No saved links yet.<br />Type <kbd>p</kbd> + space in the address bar, or <kbd>p/keyword</kbd> directly!</div>
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
                  <button
                    className="copy-icon-btn"
                    data-keyword={keyword}
                    title="Copy URL"
                    onClick={(e) => handleCopy(e, pad.url)}
                  >
                    {copiedKeyword === keyword
                      ? <Check size={14} strokeWidth={2.5} />
                      : <Copy size={14} strokeWidth={2} />}
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
        <button className="footer-btn" onClick={onSettings}><Settings size={13} strokeWidth={2} style={{ verticalAlign: 'middle', marginRight: 4 }} />Settings</button>
      </div>

      <ShortcutHint />
    </div>
  );
}


import React, { useState, useEffect, useCallback, useRef } from 'react';
import { getLinks, getBlockedSuggestions, getTags } from '../../utils/storage.js';
import { syncVectors, semanticSearch } from '../../utils/embeddings.ts';
import { Copy, Check, Settings, ChevronDown, ChevronUp, Sparkles } from '../ui/Icons.jsx';

function fuzzyMatch(keyword, searchTerm) {
  let searchIdx = 0;
  for (let keyIdx = 0; keyIdx < keyword.length && searchIdx < searchTerm.length; keyIdx++) {
    if (keyword[keyIdx] === searchTerm[searchIdx]) searchIdx++;
  }
  return searchIdx === searchTerm.length;
}

const TAG_CHAR_LIMIT = 30;

export default function ListView({ onAddNew, onEditItem, onViewDetail, onViewBlocked, onSettings, onViewShortcuts }) {
  const [pads, setPads] = useState({});
  const [search, setSearch] = useState('');
  const [blockedCount, setBlockedCount] = useState(0);
  const [copiedKeyword, setCopiedKeyword] = useState(null);
  const [tags, setTags] = useState([]);
  const [activeTagIds, setActiveTagIds] = useState([]);
  const [tagsExpanded, setTagsExpanded] = useState(false);
  const [semanticMatches, setSemanticMatches] = useState([]);
  const syncInitiated = useRef(false);

  const reload = useCallback(async () => {
    const [p, b, t] = await Promise.all([getLinks(), getBlockedSuggestions(), getTags()]);
    setPads(p);
    setBlockedCount(b.length);
    setTags(t);
  }, []);

  useEffect(() => { reload(); }, [reload]);

  // Start background vector sync once links are loaded — fire-and-forget
  useEffect(() => {
    if (!syncInitiated.current && Object.keys(pads).length > 0) {
      syncInitiated.current = true;
      syncVectors(pads, tags).catch((err) => {
        console.warn('[Pteron] Background vector sync failed:', err);
      });
    }
  }, [pads, tags]);

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

  // Debounced semantic search — runs 400 ms after the user stops typing
  useEffect(() => {
    if (!search.trim()) {
      setSemanticMatches([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const matches = await semanticSearch(search.trim(), filtered);
        // Only keep results that correspond to links still in pads
        setSemanticMatches(matches.filter((m) => pads[m.keyword]));
      } catch (err) {
        console.warn('[Pteron] Semantic search failed:', err);
        setSemanticMatches([]);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [search, pads, filtered]);

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

  function renderLinkCard(keyword, pad, isSemantic = false) {
    return (
      <div key={keyword} className={`suggestion-item${isSemantic ? ' suggestion-item--semantic' : ''}`} onClick={() => onViewDetail(keyword)}>
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
  }

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
        ) : filtered.length === 0 && semanticMatches.length === 0 ? (
          <div className="empty-state">{search ? 'No matching links found.' : 'No links match the active filters.'}</div>
        ) : (
          <>
            {filtered.map((keyword) => renderLinkCard(keyword, pads[keyword]))}

            {semanticMatches.length > 0 && (
              <div className="semantic-results-section">
                <div className="semantic-results-label">
                  <Sparkles size={12} strokeWidth={2} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                  Best guess
                </div>
                {semanticMatches.map(({ keyword }) => renderLinkCard(keyword, pads[keyword], true))}
              </div>
            )}
          </>
        )}
      </div>

      <div className="list-footer">
        {blockedCount > 0 && (
          <button className="footer-btn" onClick={onViewBlocked}>Blocked ({blockedCount})</button>
        )}
        <button className="footer-btn" onClick={onSettings}><Settings size={13} strokeWidth={2} style={{ verticalAlign: 'middle', marginRight: 4 }} />Settings</button>
      </div>

      <div className="shortcut-hint">
        <button type="button" className="shortcut-link-btn" onClick={onViewShortcuts}>
          View keyboard shortcuts
        </button>
      </div>
    </div>
  );
}


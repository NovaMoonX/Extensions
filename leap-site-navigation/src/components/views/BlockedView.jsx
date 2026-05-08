import React, { useState, useEffect } from 'react';
import { getBlockedSuggestions, saveBlockedSuggestions } from '../../utils/storage.js';
import ViewHeader from '../ui/ViewHeader.jsx';

export default function BlockedView({ onBack }) {
  const [blocked, setBlocked] = useState([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    getBlockedSuggestions().then(setBlocked);
  }, []);

  async function handleUnblock(url) {
    const updated = blocked.filter(u => u !== url);
    await saveBlockedSuggestions(updated);
    setBlocked(updated);
  }

  const filtered = search
    ? blocked.filter(u => u.toLowerCase().includes(search.toLowerCase()))
    : blocked;

  return (
    <div id="blockedView">
      <ViewHeader title="Blocked Suggestions" onBack={onBack} />
      <div className="search-container">
        <input autoFocus type="text" id="blockedSearchInput" placeholder="Search blocked..."
          value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
      <div className="blocked-list-full">
        {filtered.length === 0 ? (
          <div className="empty-state">
            {blocked.length === 0 ? 'No blocked suggestions.' : 'No results match your search.'}
          </div>
        ) : filtered.map(url => (
          <div key={url} className="blocked-item">
            <div className="blocked-url" title={url}>{url}</div>
            <button className="unblock-btn" onClick={() => handleUnblock(url)}>Unblock</button>
          </div>
        ))}
      </div>
    </div>
  );
}

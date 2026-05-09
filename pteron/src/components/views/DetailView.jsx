import { useState, useEffect } from 'react';
import { getLink } from '../../utils/storage.js';
import ViewHeader from '../ui/ViewHeader.jsx';

export default function DetailView({ keyword, onBack, onEdit, onViewNotes }) {
  const [pad, setPad] = useState(null);

  useEffect(() => {
    if (keyword) getLink(keyword).then(setPad);
  }, [keyword]);

  if (!pad) return null;

  return (
    <div id="detailView">
      <ViewHeader title="Link detail" onBack={onBack} />
      <div className="detail-content">
        <div className="detail-field">
          <div className="detail-label">Keyword</div>
          <div className="detail-value detail-keyword-value">{keyword}</div>
        </div>
        <div className="detail-field">
          <div className="detail-label">Description</div>
          <div className="detail-value">{pad.description || keyword}</div>
        </div>
        <div className="detail-field">
          <div className="detail-label">URL</div>
          <a className="detail-value detail-url-value" href={pad.url} target="_blank" rel="noreferrer">{pad.url}</a>
        </div>
      </div>
      <div className="detail-actions">
        <button className="detail-notes-btn" onClick={() => onViewNotes(keyword)}>📝 Notes</button>
        <button className="detail-edit-btn" onClick={() => onEdit(keyword)}>✏️ Edit</button>
      </div>
    </div>
  );
}

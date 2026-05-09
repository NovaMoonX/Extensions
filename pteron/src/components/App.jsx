import React, { useState, useEffect, useCallback } from 'react';
import { usePopupInit } from '../hooks/usePopupInit.js';
import { bootAIEngine, onEngineStatus } from '../utils/aiEngine.ts';
import SuggestionView from './views/SuggestionView.jsx';
import FormView from './views/FormView.jsx';
import ListView from './views/ListView.jsx';
import BlockedView from './views/BlockedView.jsx';
import SettingsView from './views/SettingsView.jsx';
import DetailView from './views/DetailView.jsx';
import NotesView from './views/NotesView.jsx';
import TagManagerView from './views/TagManagerView.jsx';
import ShortcutsView from './views/ShortcutsView.jsx';
import ExportDialog from './dialogs/ExportDialog.jsx';
import ImportDialog from './dialogs/ImportDialog.jsx';

export default function App() {
  const { initialView, initialData, ready } = usePopupInit();
  const [view, setView] = useState(null);
  const [viewData, setViewData] = useState(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [engineStatus, setEngineStatus] = useState({ status: 'idle', progress: 0 });

  // Boot the AI engine the instant the popup opens — before any view is shown.
  // This means WebLLM downloads/cache-loads happen in the background while the
  // user browses the UI; by the time they reach the form it should be ready.
  useEffect(() => {
    bootAIEngine();
    const unsub = onEngineStatus(setEngineStatus);
    return unsub;
  }, []);

  useEffect(() => {
    if (ready && initialView) {
      setView(initialView);
      setViewData(initialData);
    }
  }, [ready, initialView, initialData]);

  useEffect(() => {
    // Connect to background so it can detect popup close
    const port = chrome.runtime.connect({ name: 'popup' });
    return () => port.disconnect();
  }, []);

  const navigate = useCallback((newView, data = null) => {
    setView(newView);
    setViewData(data);
  }, []);

  if (!ready || !view) return null;

  return (
    <>
      {/* WebLLM first-run download overlay — shown only once, at the App level */}
      {engineStatus.status === 'downloading' && (
        <div className="ai-webllm-overlay" role="status" aria-live="polite">
          <div className="ai-webllm-overlay-inner">
            <img src="/icons/icon-48.png" alt="Pteron" className="ai-webllm-logo" />
            <p className="ai-webllm-title">Preparing your Wings…</p>
            <p className="ai-webllm-subtitle">
              Downloading the AI model for the first time.<br />
              This only happens once.
            </p>
            <div className="ai-webllm-progress-track">
              <div
                className="ai-webllm-progress-fill"
                style={{ width: `${Math.round(engineStatus.progress * 100)}%` }}
              />
            </div>
            <span className="ai-webllm-percent">{Math.round(engineStatus.progress * 100)}%</span>
          </div>
        </div>
      )}

      {view === 'suggestion' && (
        <SuggestionView
          data={viewData}
          onCreated={() => navigate('list')}
          onEdit={(data) => navigate('form', { prefill: data })}
          onCancel={() => window.close()}
        />
      )}
      {view === 'form' && (
        <FormView
          editingKeyword={viewData?.keyword || null}
          prefillData={viewData?.prefill || null}
          pendingUrl={viewData?.pendingUrl || null}
          pendingTitle={viewData?.pendingTitle || null}
          onSaved={() => window.close()}
          onCancel={() => navigate('list')}
          onViewNotes={(keyword) => navigate('notes', { keyword, fromDetail: false })}
          onViewAll={() => navigate('list')}
          onViewShortcuts={() => navigate('shortcuts', { from: 'form', returnData: viewData })}
        />
      )}
      {view === 'list' && (
        <ListView
          onAddNew={() => navigate('form', null)}
          onEditItem={(keyword) => navigate('form', { keyword })}
          onViewDetail={(keyword) => navigate('detail', { keyword })}
          onViewBlocked={() => navigate('blocked')}
          onSettings={() => navigate('settings')}
          onViewShortcuts={() => navigate('shortcuts', { from: 'list' })}
        />
      )}
      {view === 'blocked' && (
        <BlockedView
          onBack={() => navigate('list')}
        />
      )}
      {view === 'settings' && (
        <SettingsView
          onBack={() => navigate('list')}
          onExport={() => setExportOpen(true)}
          onImport={() => setImportOpen(true)}
          onManageTags={() => navigate('tags')}
        />
      )}
      {view === 'tags' && (
        <TagManagerView
          onBack={() => navigate('settings')}
        />
      )}
      {view === 'detail' && (
        <DetailView
          keyword={viewData?.keyword}
          onBack={() => navigate('list')}
          onEdit={(keyword) => navigate('form', { keyword })}
          onViewNotes={(keyword) => navigate('notes', { keyword, fromDetail: true })}
        />
      )}
      {view === 'notes' && (
        <NotesView
          keyword={viewData?.keyword || null}
          fromDetail={viewData?.fromDetail || false}
          onBack={(keyword, fromDetail) => fromDetail ? navigate('detail', { keyword }) : navigate('list')}
          onCreateLink={() => navigate('form', null)}
        />
      )}
      {view === 'shortcuts' && (
        <ShortcutsView
          onBack={() => navigate(viewData?.from === 'form' ? 'form' : 'list', viewData?.from === 'form' ? viewData?.returnData || null : null)}
        />
      )}
      {exportOpen && (
        <ExportDialog onClose={() => setExportOpen(false)} />
      )}
      {importOpen && (
        <ImportDialog onClose={() => setImportOpen(false)} />
      )}
    </>
  );
}

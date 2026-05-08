import React, { useState, useEffect, useCallback } from 'react';
import { usePopupInit } from '../hooks/usePopupInit.js';
import SuggestionView from './views/SuggestionView.jsx';
import FormView from './views/FormView.jsx';
import ListView from './views/ListView.jsx';
import BlockedView from './views/BlockedView.jsx';
import SettingsView from './views/SettingsView.jsx';
import DetailView from './views/DetailView.jsx';
import LeafletsView from './views/LeafletsView.jsx';
import ExportDialog from './dialogs/ExportDialog.jsx';
import ImportDialog from './dialogs/ImportDialog.jsx';

export default function App() {
  const { initialView, initialData, ready } = usePopupInit();
  const [view, setView] = useState(null);
  const [viewData, setViewData] = useState(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

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
          onViewLeaflets={(keyword) => navigate('leaflets', { keyword, fromDetail: false })}
          onViewAll={() => navigate('list')}
        />
      )}
      {view === 'list' && (
        <ListView
          onAddNew={() => navigate('form', null)}
          onEditItem={(keyword) => navigate('form', { keyword })}
          onViewDetail={(keyword) => navigate('detail', { keyword })}
          onViewBlocked={() => navigate('blocked')}
          onSettings={() => navigate('settings')}
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
        />
      )}
      {view === 'detail' && (
        <DetailView
          keyword={viewData?.keyword}
          onBack={() => navigate('list')}
          onEdit={(keyword) => navigate('form', { keyword })}
          onLeaflets={(keyword) => navigate('leaflets', { keyword, fromDetail: true })}
        />
      )}
      {view === 'leaflets' && (
        <LeafletsView
          keyword={viewData?.keyword || null}
          fromDetail={viewData?.fromDetail || false}
          onBack={(keyword, fromDetail) => fromDetail ? navigate('detail', { keyword }) : navigate('list')}
          onCreateLilyPad={() => navigate('form', null)}
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

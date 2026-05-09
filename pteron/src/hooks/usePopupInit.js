import { useState, useEffect } from 'react';

export function usePopupInit() {
  const [initialView, setInitialView] = useState(null);
  const [initialData, setInitialData] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    async function init() {
      const sessionData = await chrome.storage.session.get([
        'pendingUrl',
        'pendingTitle',
        'suggestedGoLink',
        'openNotesForKeyword',
        'openNotesForCurrentPage',
        'openDetailForKeyword',
      ]);

      const {
        pendingUrl,
        pendingTitle,
        suggestedGoLink,
        openNotesForKeyword,
        openNotesForCurrentPage,
        openDetailForKeyword,
      } = sessionData;

      if (suggestedGoLink) {
        setInitialView('suggestion');
        setInitialData(suggestedGoLink);
      } else if (openDetailForKeyword) {
        await chrome.storage.session.remove('openDetailForKeyword');
        setInitialView('detail');
        setInitialData({ keyword: openDetailForKeyword });
      } else if (openNotesForKeyword) {
        await chrome.storage.session.remove('openNotesForKeyword');
        setInitialView('leaflets');
        setInitialData({ keyword: openNotesForKeyword, fromDetail: false });
      } else if (openNotesForCurrentPage) {
        await chrome.storage.session.remove('openNotesForCurrentPage');
        setInitialView('leaflets');
        setInitialData({ keyword: null, fromDetail: false });
      } else if (pendingUrl) {
        setInitialView('form');
        setInitialData({ pendingUrl, pendingTitle });
      } else {
        setInitialView('list');
        setInitialData(null);
      }

      setReady(true);
    }

    init();
  }, []);

  return { initialView, initialData, ready };
}

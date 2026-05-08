import { extractSuggestionFieldsFromTitle, stripQueryParams } from '../../utils/url.js';

document.addEventListener('DOMContentLoaded', async () => {
  const urlInput = document.getElementById('url');
  const stripQueryParamsToggle = document.getElementById('stripQueryParamsToggle');
  const toggleGroup = stripQueryParamsToggle.closest('.toggle-group');
  const keywordInput = document.getElementById('keyword');
  const descriptionInput = document.getElementById('description');
  const form = document.getElementById('suggestionForm');
  const cancelBtn = document.getElementById('cancelBtn');
  const messageDiv = document.getElementById('message');
  const formView = document.getElementById('formView');
  const listView = document.getElementById('listView');
  const suggestionView = document.getElementById('suggestionView');
  const viewAllBtn = document.getElementById('viewAllBtn');
  const addNewBtn = document.getElementById('addNewBtn');
  const suggestionsList = document.getElementById('suggestionsList');
  const formTitle = document.getElementById('formTitle');
  const saveBtn = document.getElementById('saveBtn');
  const searchInput = document.getElementById('searchInput');
  const keywordWarning = document.getElementById('keywordWarning');
  const deleteBtn = document.getElementById('deleteBtn');
  const formNotesBtn = document.getElementById('formNotesBtn');

  // Suggestion view elements
  const suggestionPrompt = document.getElementById('suggestionPrompt');
  const previewKeyword = document.getElementById('previewKeyword');
  const previewDescription = document.getElementById('previewDescription');
  const previewUrl = document.getElementById('previewUrl');
  const createSuggestionBtn = document.getElementById('createSuggestionBtn');
  const editSuggestionBtn = document.getElementById('editSuggestionBtn');
  const cancelSuggestionBtn = document.getElementById('cancelSuggestionBtn');
  const blockSuggestionBtn = document.getElementById('blockSuggestionBtn');

  // List footer buttons
  const viewBlockedBtn = document.getElementById('viewBlockedBtn');
  const settingsBtn = document.getElementById('settingsBtn');

  // Blocked view elements
  const blockedView = document.getElementById('blockedView');
  const blockedList = document.getElementById('blockedList');
  const blockedSearchInput = document.getElementById('blockedSearchInput');
  const backFromBlockedBtn = document.getElementById('backFromBlockedBtn');

  // Settings view elements
  const settingsView = document.getElementById('settingsView');
  const autoSuggestionsToggle = document.getElementById('autoSuggestionsToggle');
  const autoOpenNotesToggle = document.getElementById('autoOpenNotesToggle');
  const backFromSettingsBtn = document.getElementById('backFromSettingsBtn');
  const exportBtn = document.getElementById('exportBtn');
  const importBtn = document.getElementById('importBtn');

  // Detail view elements
  const detailView = document.getElementById('detailView');
  const backFromDetailBtn = document.getElementById('backFromDetailBtn');
  const detailKeywordEl = document.getElementById('detailKeyword');
  const detailDescriptionEl = document.getElementById('detailDescription');
  const detailUrlEl = document.getElementById('detailUrl');
  const detailNotesBtn = document.getElementById('detailNotesBtn');
  const detailEditBtn = document.getElementById('detailEditBtn');

  // Leaflets view elements
  const notesView = document.getElementById('notesView');
  const backFromNotesBtn = document.getElementById('backFromNotesBtn');
  const noQuickLinkPrompt = document.getElementById('noQuickLinkPrompt');
  const notesContent = document.getElementById('notesContent');
  const notesKeywordLabel = document.getElementById('notesKeywordLabel');
  const notesViewMode = document.getElementById('notesViewMode');
  const notesTextDisplay = document.getElementById('notesTextDisplay');
  const editNoteBtn = document.getElementById('editNoteBtn');
  const notesEditMode = document.getElementById('notesEditMode');
  const noteTextarea = document.getElementById('noteTextarea');
  const saveNoteBtn = document.getElementById('saveNoteBtn');
  const cancelNoteEditBtn = document.getElementById('cancelNoteEditBtn');
  const createLinkFromNotesBtn = document.getElementById('createLinkFromNotesBtn');

  // Export dialog elements
  const exportDialog = document.getElementById('exportDialog');
  const exportTextarea = document.getElementById('exportTextarea');
  const downloadExportBtn = document.getElementById('downloadExportBtn');
  const closeExportBtn = document.getElementById('closeExportBtn');
  const closeExportDialogBtn = document.getElementById('closeExportDialogBtn');

  // Import dialog elements
  const importDialog = document.getElementById('importDialog');
  const importFileInput = document.getElementById('importFileInput');
  const overwriteToggle = document.getElementById('overwriteToggle');
  const importMessage = document.getElementById('importMessage');
  const doImportBtn = document.getElementById('doImportBtn');
  const closeImportBtn = document.getElementById('closeImportBtn');
  const closeImportDialogBtn = document.getElementById('closeImportDialogBtn');

  let editingKeyword = null;
  let allSuggestions = { keys: [], map: {} };
  let suggestedData = null;
  let originalUrlWithParams = null;
  let currentDetailKeyword = null;
  let currentNoteKeyword = null;
  let noteFromDetailView = false;
  let originalNoteText = null;

  async function checkKeywordExists(keyword) {
    const result = await chrome.storage.sync.get(keyword);
    return result && result[keyword];
  }

  // Returns a validation error string if the keyword is invalid, or null if valid.
  async function getKeywordError(keyword, currentEditingKeyword) {
    if (keyword.startsWith('__')) {
      return "Keywords cannot begin with '__' — that prefix is reserved for internal use.";
    }
    if (keyword && keyword !== currentEditingKeyword) {
      const exists = await checkKeywordExists(keyword);
      if (exists) return 'A lily pad with this keyword already exists.';
    }
    return null;
  }

  keywordInput.addEventListener('input', async (e) => {
    const keyword = e.target.value;
    updateKeywordWarning(keyword);
  });

  stripQueryParamsToggle.addEventListener('change', (e) => {
    if (e.target.checked) {
      urlInput.value = stripQueryParams(urlInput.value);
    } else {
      if (originalUrlWithParams) {
        urlInput.value = originalUrlWithParams;
      }
    }
  });

  async function updateKeywordWarning(keyword) {
    const trimmedKeyword = keyword.trim().toLowerCase();
    const error = trimmedKeyword ? await getKeywordError(trimmedKeyword, editingKeyword) : null;
    if (error) {
      keywordWarning.textContent = error;
      keywordWarning.classList.remove('hidden');
    } else {
      keywordWarning.classList.add('hidden');
    }
  }

  const sessionData = await chrome.storage.session.get([
    'pendingUrl',
    'pendingTitle',
    'suggestedGoLink',
    'openNotesForKeyword',
    'openNotesForCurrentPage',
    'openDetailForKeyword',
  ]);
  const { pendingUrl, pendingTitle, suggestedGoLink, openNotesForKeyword, openNotesForCurrentPage, openDetailForKeyword } = sessionData;

  if (suggestedGoLink) {
    suggestedData = suggestedGoLink;
    showSuggestionView(suggestedGoLink);
  } else if (openDetailForKeyword) {
    await chrome.storage.session.remove('openDetailForKeyword');
    showDetailView(openDetailForKeyword);
  } else if (openNotesForKeyword) {
    await chrome.storage.session.remove('openNotesForKeyword');
    showNotesView(openNotesForKeyword, false);
  } else if (openNotesForCurrentPage) {
    await chrome.storage.session.remove('openNotesForCurrentPage');
    showNotesView(null, false);
  } else if (pendingUrl) {
    showFormView();

    const { url, keyword, description, originalUrl } = extractSuggestionFieldsFromTitle(pendingTitle, pendingUrl);
    originalUrlWithParams = originalUrl || pendingUrl;
    urlInput.value = originalUrlWithParams;
    keywordInput.value = keyword;
    descriptionInput.value = description;

    await updateKeywordWarning(keyword);

    descriptionInput.focus();
  } else {
    showListView();
  }

  function showSuggestionView(data) {
    suggestionView.classList.remove('hidden');
    formView.classList.add('hidden');
    listView.classList.add('hidden');

    suggestionPrompt.textContent = `You've visited this page frequently. Add a Lily Pad for easy access?`;
    previewKeyword.textContent = data.keyword;
    previewDescription.textContent = data.description;
    previewUrl.textContent = data.url;
  }

  function showFormView(isEdit = false) {
    formView.classList.remove('hidden');
    listView.classList.add('hidden');
    detailView.classList.add('hidden');
    notesView.classList.add('hidden');

    if (isEdit) {
      formTitle.textContent = 'Edit Lily Pad';
      saveBtn.textContent = 'Update';
      deleteBtn.classList.remove('hidden');
      formNotesBtn.classList.remove('hidden');
      toggleGroup.classList.add('hidden');
    } else {
      formTitle.textContent = 'Add New Lily Pad';
      saveBtn.textContent = 'Save';
      deleteBtn.classList.add('hidden');
      formNotesBtn.classList.add('hidden');
      toggleGroup.classList.remove('hidden');
      stripQueryParamsToggle.checked = false;
    }
  }

  function showListView() {
    formView.classList.add('hidden');
    listView.classList.remove('hidden');
    suggestionView.classList.add('hidden');
    blockedView.classList.add('hidden');
    settingsView.classList.add('hidden');
    detailView.classList.add('hidden');
    notesView.classList.add('hidden');
    searchInput.value = '';
    loadSuggestions();
    updateBlockedCount();
    searchInput.focus();
  }

  function showBlockedView() {
    listView.classList.add('hidden');
    blockedView.classList.remove('hidden');
    blockedSearchInput.value = '';
    loadBlockedUrls();
    blockedSearchInput.focus();
  }

  function showSettingsView() {
    listView.classList.add('hidden');
    settingsView.classList.remove('hidden');
    loadSettings();
  }

  async function showDetailView(keyword) {
    const result = await chrome.storage.sync.get(keyword);
    const suggestion = result[keyword];
    if (!suggestion) return;

    currentDetailKeyword = keyword;

    formView.classList.add('hidden');
    listView.classList.add('hidden');
    suggestionView.classList.add('hidden');
    blockedView.classList.add('hidden');
    settingsView.classList.add('hidden');
    notesView.classList.add('hidden');

    detailKeywordEl.textContent = keyword;
    detailDescriptionEl.textContent = suggestion.description || keyword;
    detailUrlEl.textContent = suggestion.url;
    detailUrlEl.href = suggestion.url;

    detailView.classList.remove('hidden');
  }

  async function showNotesView(keyword, fromDetail) {
    currentNoteKeyword = keyword;
    noteFromDetailView = fromDetail;

    formView.classList.add('hidden');
    listView.classList.add('hidden');
    suggestionView.classList.add('hidden');
    blockedView.classList.add('hidden');
    settingsView.classList.add('hidden');
    detailView.classList.add('hidden');

    if (!keyword) {
      noQuickLinkPrompt.classList.remove('hidden');
      notesContent.classList.add('hidden');
    } else {
      noQuickLinkPrompt.classList.add('hidden');
      notesContent.classList.remove('hidden');

      notesKeywordLabel.textContent = keyword;

      const noteKey = `__note_${keyword}`;
      const result = await chrome.storage.sync.get(noteKey);
      const noteText = result[noteKey] || '';
      originalNoteText = noteText;

      if (noteText) {
        notesTextDisplay.textContent = noteText;
        notesTextDisplay.classList.remove('empty');
        notesViewMode.classList.remove('hidden');
        notesEditMode.classList.add('hidden');
      } else {
        notesTextDisplay.textContent = '';
        notesViewMode.classList.add('hidden');
        notesEditMode.classList.remove('hidden');
        noteTextarea.value = '';
        noteTextarea.focus();
      }
    }

    notesView.classList.remove('hidden');
  }

  async function updateBlockedCount() {
    const { __blockedSuggestions: blockedSuggestions = [] } = await chrome.storage.sync.get('__blockedSuggestions');
    const count = blockedSuggestions.length;
    if (count > 0) {
      viewBlockedBtn.textContent = `Blocked (${count})`;
      viewBlockedBtn.classList.remove('hidden');
    } else {
      viewBlockedBtn.classList.add('hidden');
    }
  }

  async function loadBlockedUrls(searchTerm = '') {
    const { __blockedSuggestions: blockedSuggestions = [] } = await chrome.storage.sync.get('__blockedSuggestions');

    const filtered = searchTerm
      ? blockedSuggestions.filter(url => url.toLowerCase().includes(searchTerm.toLowerCase()))
      : blockedSuggestions;

    if (filtered.length === 0) {
      blockedList.innerHTML = blockedSuggestions.length === 0
        ? '<div class="empty-state">No blocked suggestions.</div>'
        : '<div class="empty-state">No results match your search.</div>';
      return;
    }

    blockedList.innerHTML = filtered
      .map(url => `
        <div class="blocked-item">
          <div class="blocked-url" title="${url}">${url}</div>
          <button class="unblock-btn" data-url="${url}">Unblock</button>
        </div>
      `)
      .join('');

    document.querySelectorAll('.unblock-btn').forEach(btn => {
      btn.addEventListener('click', handleUnblock);
    });
  }

  async function handleUnblock(e) {
    const url = e.target.dataset.url;
    const { __blockedSuggestions: blockedSuggestions = [] } = await chrome.storage.sync.get('__blockedSuggestions');

    const updatedBlocked = blockedSuggestions.filter(blockedUrl => blockedUrl !== url);
    await chrome.storage.sync.set({ __blockedSuggestions: updatedBlocked });

    loadBlockedUrls(blockedSearchInput.value);
  }

  async function loadSettings() {
    const { __settings: settings = {} } = await chrome.storage.sync.get('__settings');
    autoSuggestionsToggle.checked = settings.autoSuggestionsEnabled !== false;
    autoOpenNotesToggle.checked = settings.autoOpenNotes !== false;
  }

  async function saveSettings() {
    const { __settings: settings = {} } = await chrome.storage.sync.get('__settings');
    settings.autoSuggestionsEnabled = autoSuggestionsToggle.checked;
    settings.autoOpenNotes = autoOpenNotesToggle.checked;
    await chrome.storage.sync.set({ __settings: settings });
  }

  function fuzzyMatchKeyword(keyword, searchTerm) {
    let searchIdx = 0;
    for (let keyIdx = 0; keyIdx < keyword.length && searchIdx < searchTerm.length; keyIdx++) {
      if (keyword[keyIdx] === searchTerm[searchIdx]) searchIdx++;
    }
    return searchIdx === searchTerm.length;
  }

  async function loadSuggestions(searchTerm = '') {
    const suggestionsMap = await chrome.storage.sync.get(null);
    let suggestionKeys = Object.keys(suggestionsMap);

    suggestionKeys = suggestionKeys.filter(key =>
      !key.startsWith('__') &&
      suggestionsMap[key] &&
      typeof suggestionsMap[key] === 'object' &&
      !Array.isArray(suggestionsMap[key]) &&
      suggestionsMap[key].url
    );

    allSuggestions = { keys: suggestionKeys, map: suggestionsMap };

    if (suggestionKeys.length === 0) {
      suggestionsList.innerHTML = '<div class="empty-state">No lily pads yet.<br>Add one using the omnibox!</div>';
      return;
    }

    let filteredKeys;
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      const substringMatches = [];
      const fuzzyMatches = [];

      for (const keyword of suggestionKeys) {
        const suggestion = suggestionsMap[keyword];
        const keywordLower = keyword.toLowerCase();

        const isSubstringMatch =
          keywordLower.includes(searchLower) ||
          (suggestion.description && suggestion.description.toLowerCase().includes(searchLower)) ||
          suggestion.url.toLowerCase().includes(searchLower);

        if (isSubstringMatch) {
          substringMatches.push(keyword);
        } else if (fuzzyMatchKeyword(keywordLower, searchLower)) {
          fuzzyMatches.push(keyword);
        }
      }

      filteredKeys = [...substringMatches, ...fuzzyMatches];
    } else {
      filteredKeys = suggestionKeys;
    }

    if (filteredKeys.length === 0) {
      suggestionsList.innerHTML = '<div class="empty-state">No matching lily pads found.</div>';
      return;
    }

    suggestionsList.innerHTML = filteredKeys
      .map(keyword => {
        const suggestion = suggestionsMap[keyword];
        return `
          <div class="suggestion-item" data-keyword="${keyword}">
            <div class="suggestion-header">
              <a href="${suggestion.url}" target="_blank" class="suggestion-keyword">${keyword}</a>
              <div class="suggestion-actions">
                <button class="edit-btn" data-keyword="${keyword}">Edit</button>
                <button class="copy-btn" data-keyword="${keyword}" data-url="${suggestion.url}">Copy URL</button>
              </div>
            </div>
            <div class="suggestion-description">${suggestion.description || keyword}</div>
            <div class="suggestion-url">${suggestion.url}</div>
          </div>
        `;
      })
      .join('');
  }

  suggestionsList.addEventListener('click', async (e) => {
    if (e.target.classList.contains('edit-btn')) {
      await handleEdit(e);
      return;
    }
    if (e.target.classList.contains('copy-btn')) {
      await handleCopy(e);
      return;
    }
    if (!e.target.closest('.suggestion-keyword') && !e.target.closest('.suggestion-actions')) {
      const item = e.target.closest('.suggestion-item');
      if (item) {
        await showDetailView(item.dataset.keyword);
      }
    }
  });

  async function handleEdit(e) {
    const keyword = e.target.dataset.keyword;
    const result = await chrome.storage.sync.get(keyword);
    const suggestion = result[keyword];

    if (suggestion) {
      editingKeyword = keyword;
      originalUrlWithParams = null;
      urlInput.value = suggestion.url;
      keywordInput.value = keyword;
      descriptionInput.value = suggestion.description || '';

      showFormView(true);
      descriptionInput.focus();
    }
  }

  async function handleCopy(e) {
    const url = e.target.dataset.url;
    try {
      await navigator.clipboard.writeText(url);
      const btn = e.target;
      const originalText = btn.textContent;
      btn.textContent = 'Copied!';
      setTimeout(() => {
        btn.textContent = originalText;
      }, 1500);
    } catch (error) {
      console.error('Error copying URL:', error);
    }
  }

  viewAllBtn.addEventListener('click', showListView);

  searchInput.addEventListener('input', (e) => {
    loadSuggestions(e.target.value);
  });

  viewBlockedBtn.addEventListener('click', showBlockedView);
  backFromBlockedBtn.addEventListener('click', showListView);

  blockedSearchInput.addEventListener('input', (e) => {
    loadBlockedUrls(e.target.value);
  });

  settingsBtn.addEventListener('click', showSettingsView);
  backFromSettingsBtn.addEventListener('click', showListView);

  autoSuggestionsToggle.addEventListener('change', saveSettings);
  autoOpenNotesToggle.addEventListener('change', saveSettings);

  formNotesBtn.addEventListener('click', () => {
    if (editingKeyword) {
      showNotesView(editingKeyword, false);
    }
  });

  backFromDetailBtn.addEventListener('click', showListView);

  detailNotesBtn.addEventListener('click', () => {
    showNotesView(currentDetailKeyword, true);
  });

  detailEditBtn.addEventListener('click', async () => {
    const result = await chrome.storage.sync.get(currentDetailKeyword);
    const suggestion = result[currentDetailKeyword];
    if (suggestion) {
      editingKeyword = currentDetailKeyword;
      originalUrlWithParams = null;
      urlInput.value = suggestion.url;
      keywordInput.value = currentDetailKeyword;
      descriptionInput.value = suggestion.description || '';
      showFormView(true);
      descriptionInput.focus();
    }
  });

  backFromNotesBtn.addEventListener('click', () => {
    if (noteFromDetailView) {
      showDetailView(currentNoteKeyword);
    } else {
      showListView();
    }
  });

  editNoteBtn.addEventListener('click', () => {
    noteTextarea.value = notesTextDisplay.textContent;
    notesViewMode.classList.add('hidden');
    notesEditMode.classList.remove('hidden');
    noteTextarea.focus();
  });

  saveNoteBtn.addEventListener('click', async () => {
    const noteText = noteTextarea.value.trim();
    const noteKey = `__note_${currentNoteKeyword}`;

    if (noteText) {
      await chrome.storage.sync.set({ [noteKey]: noteText });
    } else {
      await chrome.storage.sync.remove(noteKey);
    }

    originalNoteText = noteText;

    if (noteText) {
      notesTextDisplay.textContent = noteText;
      notesTextDisplay.classList.remove('empty');
    } else {
      notesTextDisplay.textContent = 'No leaflets yet.';
      notesTextDisplay.classList.add('empty');
    }
    notesViewMode.classList.remove('hidden');
    notesEditMode.classList.add('hidden');
  });

  cancelNoteEditBtn.addEventListener('click', () => {
    if (originalNoteText) {
      notesTextDisplay.textContent = originalNoteText;
      notesTextDisplay.classList.remove('empty');
      notesViewMode.classList.remove('hidden');
      notesEditMode.classList.add('hidden');
    } else {
      if (noteFromDetailView) {
        showDetailView(currentNoteKeyword);
      } else {
        showListView();
      }
    }
  });

  createLinkFromNotesBtn.addEventListener('click', async () => {
    editingKeyword = null;
    originalUrlWithParams = null;
    form.reset();

    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs[0]?.url) {
        const { keyword, description, originalUrl } = extractSuggestionFieldsFromTitle(tabs[0].title, tabs[0].url);
        originalUrlWithParams = originalUrl || tabs[0].url;
        urlInput.value = originalUrlWithParams;
        keywordInput.value = keyword;
        descriptionInput.value = description;
        await updateKeywordWarning(keyword);
      }
    } catch (error) {
      console.error('Error getting current tab:', error);
    }

    showFormView(false);
    keywordInput.focus();
  });

  addNewBtn.addEventListener('click', async () => {
    editingKeyword = null;
    originalUrlWithParams = null;
    form.reset();

    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs[0]?.url) {
        const { keyword, description, originalUrl } = extractSuggestionFieldsFromTitle(tabs[0].title, tabs[0].url);
        originalUrlWithParams = originalUrl || tabs[0].url;
        urlInput.value = originalUrlWithParams;
        keywordInput.value = keyword;
        descriptionInput.value = description;

        await updateKeywordWarning(keyword);
      }
    } catch (error) {
      console.error('Error getting current tab:', error);
    }

    showFormView(false);
    keywordInput.focus();
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const keyword = keywordInput.value.trim().toLowerCase();
    const description = descriptionInput.value.trim();
    const url = urlInput.value.trim();

    if (!keyword || !url) {
      showMessage('Keyword and URL are required', 'error');
      return;
    }

    const keywordError = await getKeywordError(keyword, editingKeyword);
    if (keywordError) {
      showMessage(keywordError, 'error');
      return;
    }

    try {
      if (editingKeyword && editingKeyword !== keyword) {
        await chrome.storage.sync.remove(editingKeyword);
      }

      const existingResult = await chrome.storage.sync.get(keyword);
      const existingData = existingResult[keyword] || {};

      await chrome.storage.sync.set({
        [keyword]: {
          url,
          description: description || keyword,
          timesUsed: existingData.timesUsed || 0,
          lastUsed: existingData.lastUsed || Date.now()
        }
      });

      await chrome.storage.session.remove('pendingUrl');

      showMessage(editingKeyword ? 'Lily Pad updated!' : 'Lily Pad saved!', 'success');

      setTimeout(() => {
        editingKeyword = null;
        form.reset();
        window.close();
      }, 750);
    } catch (error) {
      console.error('Error saving lily pad:', error);
      showMessage('Error saving lily pad', 'error');
    }
  });

  cancelBtn.addEventListener('click', () => {
    editingKeyword = null;
    form.reset();

    chrome.storage.session.get('pendingUrl').then(({ pendingUrl }) => {
      if (pendingUrl) {
        chrome.storage.session.remove('pendingUrl');
        window.close();
      } else {
        showListView();
      }
    });
  });

  deleteBtn.addEventListener('click', async () => {
    if (!editingKeyword) {
      console.warn('Delete button clicked without an active editing keyword');
      return;
    }

    if (!confirm(`Delete your lily pad "${editingKeyword}"?`)) {
      return;
    }

    try {
      await chrome.storage.sync.remove(editingKeyword);
      editingKeyword = null;
      form.reset();
      showListView();
    } catch (error) {
      console.error('Error deleting lily pad:', error);
    }
  });

  function showMessage(text, type) {
    messageDiv.textContent = text;
    messageDiv.className = `message ${type}`;

    if (type === 'success') {
      setTimeout(() => {
        messageDiv.className = 'message';
      }, 3000);
    }
  }

  createSuggestionBtn.addEventListener('click', async () => {
    if (!suggestedData) return;

    try {
      await chrome.storage.sync.set({
        [suggestedData.keyword]: {
          url: suggestedData.url,
          description: suggestedData.description,
          timesUsed: 0,
          lastUsed: Date.now()
        }
      });

      await chrome.storage.session.remove('suggestedGoLink');

      suggestionView.classList.add('hidden');
      listView.classList.add('hidden');

      formView.classList.remove('hidden');
      form.style.display = 'none';
      formTitle.style.display = 'none';
      viewAllBtn.style.display = 'none';
      document.querySelector('.shortcut-hint').style.display = 'none';

      messageDiv.textContent = 'Lily Pad added!';
      messageDiv.className = 'message success';

      setTimeout(() => {
        window.close();
      }, 750);
    } catch (error) {
      console.error('Error creating lily pad:', error);
    }
  });

  editSuggestionBtn.addEventListener('click', async () => {
    if (!suggestedData) return;

    urlInput.value = suggestedData.url;
    keywordInput.value = suggestedData.keyword;
    descriptionInput.value = suggestedData.description;

    await chrome.storage.session.remove('suggestedGoLink');

    showFormView(false);
    keywordInput.focus();
  });

  cancelSuggestionBtn.addEventListener('click', async () => {
    await chrome.storage.session.remove('suggestedGoLink');
    window.close();
  });

  blockSuggestionBtn.addEventListener('click', async () => {
    if (!suggestedData) return;

    try {
      const { __blockedSuggestions: blockedSuggestions = [] } = await chrome.storage.sync.get('__blockedSuggestions');

      if (!blockedSuggestions.includes(suggestedData.url)) {
        blockedSuggestions.push(suggestedData.url);
        await chrome.storage.sync.set({ __blockedSuggestions: blockedSuggestions });
      }

      await chrome.storage.session.remove('suggestedGoLink');

      window.close();
    } catch (error) {
      console.error('Error blocking suggestion:', error);
    }
  });

  // --- Export functionality ---

  async function exportData() {
    const allData = await chrome.storage.sync.get(null);
    const exportObj = {
      version: 2,
      exportedAt: new Date().toISOString(),
      lilyPads: {},
      leaflets: {},
      blockedSuggestions: allData['__blockedSuggestions'] || [],
      settings: allData['__settings'] || {}
    };

    for (const [key, value] of Object.entries(allData)) {
      if (key.startsWith('__note_')) {
        const keyword = key.slice('__note_'.length);
        exportObj.leaflets[keyword] = value;
      } else if (!key.startsWith('__')) {
        if (value && typeof value === 'object' && !Array.isArray(value) && value.url) {
          exportObj.lilyPads[key] = value;
        }
      }
    }

    return JSON.stringify(exportObj, null, 2);
  }

  exportBtn.addEventListener('click', async () => {
    const json = await exportData();
    exportTextarea.value = json;
    exportDialog.classList.remove('hidden');
  });

  closeExportBtn.addEventListener('click', () => {
    exportDialog.classList.add('hidden');
  });

  closeExportDialogBtn.addEventListener('click', () => {
    exportDialog.classList.add('hidden');
  });

  downloadExportBtn.addEventListener('click', () => {
    const json = exportTextarea.value;
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `leap-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });

  // --- Import functionality ---

  async function importData(jsonText, overwrite) {
    let parsed;
    try {
      parsed = JSON.parse(jsonText);
    } catch {
      throw new Error('Invalid JSON file');
    }

    const toSet = {};

    if (parsed.lilyPads && typeof parsed.lilyPads === 'object') {
      for (const [keyword, value] of Object.entries(parsed.lilyPads)) {
        if (keyword.startsWith('__')) continue;
        if (!overwrite) {
          const existing = await chrome.storage.sync.get(keyword);
          if (existing[keyword]) continue;
        }
        toSet[keyword] = value;
      }
    }

    if (parsed.leaflets && typeof parsed.leaflets === 'object') {
      for (const [keyword, noteText] of Object.entries(parsed.leaflets)) {
        if (keyword.startsWith('__')) continue;
        const noteKey = `__note_${keyword}`;
        if (!overwrite) {
          const existing = await chrome.storage.sync.get(noteKey);
          if (existing[noteKey]) continue;
        }
        if (noteText) toSet[noteKey] = noteText;
      }
    }

    if (parsed.blockedSuggestions && Array.isArray(parsed.blockedSuggestions)) {
      const { __blockedSuggestions: existing = [] } = await chrome.storage.sync.get('__blockedSuggestions');
      const merged = [...new Set([...existing, ...parsed.blockedSuggestions])];
      toSet['__blockedSuggestions'] = merged;
    }

    if (overwrite && parsed.settings && typeof parsed.settings === 'object') {
      toSet['__settings'] = parsed.settings;
    }

    if (Object.keys(toSet).length > 0) {
      await chrome.storage.sync.set(toSet);
    }

    return Object.keys(toSet).length;
  }

  importBtn.addEventListener('click', () => {
    importFileInput.value = '';
    overwriteToggle.checked = false;
    importMessage.className = 'message';
    importMessage.textContent = '';
    importDialog.classList.remove('hidden');
  });

  closeImportBtn.addEventListener('click', () => {
    importDialog.classList.add('hidden');
  });

  closeImportDialogBtn.addEventListener('click', () => {
    importDialog.classList.add('hidden');
  });

  doImportBtn.addEventListener('click', async () => {
    const file = importFileInput.files[0];
    if (!file) {
      importMessage.textContent = 'Please select a file first.';
      importMessage.className = 'message error';
      return;
    }

    try {
      const text = await file.text();
      const count = await importData(text, overwriteToggle.checked);
      importMessage.textContent = `Imported ${count} item${count !== 1 ? 's' : ''} successfully.`;
      importMessage.className = 'message success';
    } catch (err) {
      importMessage.textContent = err.message || 'Import failed.';
      importMessage.className = 'message error';
    }
  });

  // Connect to background so it can detect when popup closes
  const port = chrome.runtime.connect({ name: 'popup' });
});

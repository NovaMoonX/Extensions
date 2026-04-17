import { extractSuggestionFieldsFromTitle, stripQueryParams } from './service-worker.util.js';

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

  // Detail view elements
  const detailView = document.getElementById('detailView');
  const backFromDetailBtn = document.getElementById('backFromDetailBtn');
  const detailKeywordEl = document.getElementById('detailKeyword');
  const detailDescriptionEl = document.getElementById('detailDescription');
  const detailUrlEl = document.getElementById('detailUrl');
  const detailNotesBtn = document.getElementById('detailNotesBtn');
  const detailEditBtn = document.getElementById('detailEditBtn');

  // Notes view elements
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

  let editingKeyword = null;
  let allSuggestions = { keys: [], map: {} };
  let suggestedData = null;
  let originalUrlWithParams = null;
  let currentDetailKeyword = null;
  let currentNoteKeyword = null;
  let noteFromDetailView = false;
  let originalNoteText = null;

  // Function to check if keyword exists
  async function checkKeywordExists(keyword) {
    const result = await chrome.storage.sync.get(keyword);
    return result && result[keyword];
  }

  // Real-time validation for keyword input
  keywordInput.addEventListener('input', async (e) => {
    const keyword = e.target.value
    updateKeywordWarning(keyword);
  });

  // Handle query parameter stripping toggle
  stripQueryParamsToggle.addEventListener('change', (e) => {
    if (e.target.checked) {
      // Exclude params - strip the current URL
      urlInput.value = stripQueryParams(urlInput.value);
    } else {
      // Include params - restore the original URL with params
      if (originalUrlWithParams) {
        urlInput.value = originalUrlWithParams;
      }
    }
  });

  async function updateKeywordWarning(keyword) {
    const trimmedKeyword = keyword.trim().toLowerCase();
    
    if (trimmedKeyword && trimmedKeyword !== editingKeyword) {
      const exists = await checkKeywordExists(trimmedKeyword);
      if (exists) {
        keywordWarning.classList.remove('hidden');
      } else {
        keywordWarning.classList.add('hidden');
      }
    } else {
      keywordWarning.classList.add('hidden');
    }
  }

  // Check if there's a pending URL from omnibox or a suggestion from frequent visits
  const sessionData = await chrome.storage.session.get([
    'pendingUrl',
    'pendingTitle',
    'suggestedGoLink',
    'openNotesForKeyword',
    'openNotesForCurrentPage',
  ]);
  const { pendingUrl, pendingTitle, suggestedGoLink, openNotesForKeyword, openNotesForCurrentPage } = sessionData;
  
  if (suggestedGoLink) {
    // Show suggestion view for frequent visits
    suggestedData = suggestedGoLink;
    showSuggestionView(suggestedGoLink);
  } else if (openNotesForKeyword) {
    await chrome.storage.session.remove('openNotesForKeyword');
    showNotesView(openNotesForKeyword, false);
  } else if (openNotesForCurrentPage) {
    await chrome.storage.session.remove('openNotesForCurrentPage');
    showNotesView(null, false);
  } else if (pendingUrl) {
    // Show form view with pending URL
    showFormView();
    
    const { url, keyword, description, originalUrl } = extractSuggestionFieldsFromTitle(pendingTitle, pendingUrl);
    originalUrlWithParams = originalUrl || pendingUrl;
    urlInput.value = originalUrlWithParams;
    keywordInput.value = keyword;
    descriptionInput.value = description;
    
    // Check if pre-filled keyword matches existing
    await updateKeywordWarning(keyword);
    
    descriptionInput.focus();
  } else {
    // Show list view by default
    showListView();
  }

  function showSuggestionView(data) {
    suggestionView.classList.remove('hidden');
    formView.classList.add('hidden');
    listView.classList.add('hidden');

    suggestionPrompt.textContent = `You've visited this page frequently. Create a quick link for easy access?`;
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
      formTitle.textContent = 'Edit Quick Link';
      saveBtn.textContent = 'Update';
      deleteBtn.classList.remove('hidden');
      toggleGroup.classList.add('hidden');
    } else {
      formTitle.textContent = 'Add New Quick Link';
      saveBtn.textContent = 'Save';
      deleteBtn.classList.add('hidden');
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

      const noteKey = `note_${keyword}`;
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
    const { blockedSuggestions = [] } = await chrome.storage.sync.get('blockedSuggestions');
    const count = blockedSuggestions.length;
    if (count > 0) {
      viewBlockedBtn.textContent = `Blocked (${count})`;
      viewBlockedBtn.classList.remove('hidden');
    } else {
      viewBlockedBtn.classList.add('hidden');
    }
  }

  async function loadBlockedUrls(searchTerm = '') {
    const { blockedSuggestions = [] } = await chrome.storage.sync.get('blockedSuggestions');

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

    // Attach event listeners to unblock buttons
    document.querySelectorAll('.unblock-btn').forEach(btn => {
      btn.addEventListener('click', handleUnblock);
    });
  }

  async function handleUnblock(e) {
    const url = e.target.dataset.url;
    const { blockedSuggestions = [] } = await chrome.storage.sync.get('blockedSuggestions');
    
    const updatedBlocked = blockedSuggestions.filter(blockedUrl => blockedUrl !== url);
    await chrome.storage.sync.set({ blockedSuggestions: updatedBlocked });

    // Reload the blocked URLs list with current search term
    loadBlockedUrls(blockedSearchInput.value);
  }

  async function loadSettings() {
    const { settings = {} } = await chrome.storage.sync.get('settings');
    autoSuggestionsToggle.checked = settings.autoSuggestionsEnabled !== false;
    autoOpenNotesToggle.checked = settings.autoOpenNotes !== false;
  }

  async function saveSettings() {
    const { settings = {} } = await chrome.storage.sync.get('settings');
    settings.autoSuggestionsEnabled = autoSuggestionsToggle.checked;
    settings.autoOpenNotes = autoOpenNotesToggle.checked;
    await chrome.storage.sync.set({ settings });
  }

  // Returns true if every character in searchTerm appears in keyword in order (subsequence match)
  function fuzzyMatchKeyword(keyword, searchTerm) {
    let searchIdx = 0;
    for (let keyIdx = 0; keyIdx < keyword.length && searchIdx < searchTerm.length; keyIdx++) {
      if (keyword[keyIdx] === searchTerm[searchIdx]) searchIdx++;
    }
    return searchIdx === searchTerm.length;
  }

  async function loadSuggestions(searchTerm = '') {
    // Get all suggestions from storage
    const suggestionsMap = await chrome.storage.sync.get(null);
    let suggestionKeys = Object.keys(suggestionsMap);

    // Filter out non-suggestion keys
    suggestionKeys = suggestionKeys.filter(key => 
      key !== 'blockedSuggestions' && 
      key !== 'settings' &&
      !key.startsWith('note_') &&
      suggestionsMap[key] && 
      typeof suggestionsMap[key] === 'object' && 
      !Array.isArray(suggestionsMap[key])
    );

    // Store all suggestions for filtering
    allSuggestions = { keys: suggestionKeys, map: suggestionsMap };

    if (suggestionKeys.length === 0) {
      suggestionsList.innerHTML = '<div class="empty-state">No suggestions yet.<br>Add one using the omnibox!</div>';
      return;
    }

    // Filter suggestions based on search term, with fuzzy keyword matching ranked last
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
      suggestionsList.innerHTML = '<div class="empty-state">No matching suggestions found.</div>';
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

  // Event delegation for suggestion list — handles edit, copy, and card-click for detail view
  suggestionsList.addEventListener('click', async (e) => {
    if (e.target.classList.contains('edit-btn')) {
      await handleEdit(e);
      return;
    }
    if (e.target.classList.contains('copy-btn')) {
      await handleCopy(e);
      return;
    }
    // Clicking anywhere on the card (except the keyword link or action buttons) opens detail view
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

  // Detail view events
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

  // Notes view events
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
    const noteKey = `note_${currentNoteKeyword}`;

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
      notesTextDisplay.textContent = 'No notes yet.';
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
      // No existing note — go back
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
    
    // Get the current active tab's URL and title
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs[0]?.url) {
        const { keyword, description, originalUrl } = extractSuggestionFieldsFromTitle(tabs[0].title, tabs[0].url);
        originalUrlWithParams = originalUrl || tabs[0].url;
        urlInput.value = originalUrlWithParams;
        keywordInput.value = keyword;
        descriptionInput.value = description;
        
        // Check if pre-filled keyword matches existing
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

    try {
      // If editing, remove old keyword
      if (editingKeyword && editingKeyword !== keyword) {
        await chrome.storage.sync.remove(editingKeyword);
      }

      // Get existing data for this keyword (if updating)
      const existingResult = await chrome.storage.sync.get(keyword);
      const existingData = existingResult[keyword] || {};

      // Save suggestion
      await chrome.storage.sync.set({
        [keyword]: {
          url,
          description: description || keyword,
          timesUsed: existingData.timesUsed || 0,
          lastUsed: existingData.lastUsed || Date.now()
        }
      });

      // Clear session storage if this was from omnibox
      await chrome.storage.session.remove('pendingUrl');

      showMessage(editingKeyword ? 'Suggestion updated!' : 'Suggestion saved!', 'success');

      setTimeout(() => {
        editingKeyword = null;
        form.reset();
        window.close();
      }, 750);
    } catch (error) {
      console.error('Error saving suggestion:', error);
      showMessage('Error saving suggestion', 'error');
    }
  });

  cancelBtn.addEventListener('click', () => {
    editingKeyword = null;
    form.reset();
    
    // If there was a pending URL, close popup; otherwise show list
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

    if (!confirm(`Delete your go-to "${editingKeyword}"?`)) {
      return;
    }

    try {
      await chrome.storage.sync.remove(editingKeyword);
      editingKeyword = null;
      form.reset();
      showListView();
    } catch (error) {
      console.error('Error deleting suggestion:', error);
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

  // Suggestion view event handlers
  createSuggestionBtn.addEventListener('click', async () => {
    if (!suggestedData) return;

    try {
      // Save the suggested go-link
      await chrome.storage.sync.set({
        [suggestedData.keyword]: {
          url: suggestedData.url,
          description: suggestedData.description,
          timesUsed: 0,
          lastUsed: Date.now()
        }
      });

      // Clear session storage
      await chrome.storage.session.remove('suggestedGoLink');

      // Hide all views
      suggestionView.classList.add('hidden');
      listView.classList.add('hidden');
      
      // Show formView but hide the form elements
      formView.classList.remove('hidden');
      form.style.display = 'none';
      formTitle.style.display = 'none';
      viewAllBtn.style.display = 'none';
      document.querySelector('.shortcut-hint').style.display = 'none';
      
      // Show success message
      messageDiv.textContent = 'Go-to link created!';
      messageDiv.className = 'message success';

      setTimeout(() => {
        window.close();
      }, 750);
    } catch (error) {
      console.error('Error creating suggestion:', error);
    }
  });

  editSuggestionBtn.addEventListener('click', async () => {
    if (!suggestedData) return;

    // Pre-fill form with suggested data
    urlInput.value = suggestedData.url;
    keywordInput.value = suggestedData.keyword;
    descriptionInput.value = suggestedData.description;

    // Clear session storage since user is now editing
    await chrome.storage.session.remove('suggestedGoLink');

    showFormView(false);
    keywordInput.focus();
  });

  cancelSuggestionBtn.addEventListener('click', async () => {
    // Clear suggestion from session storage
    await chrome.storage.session.remove('suggestedGoLink');
    window.close();
  });

  blockSuggestionBtn.addEventListener('click', async () => {
    if (!suggestedData) return;

    try {
      // Get current blocked list
      const { blockedSuggestions = [] } = await chrome.storage.sync.get('blockedSuggestions');
      
      // Add URL to blocked list if not already there
      if (!blockedSuggestions.includes(suggestedData.url)) {
        blockedSuggestions.push(suggestedData.url);
        await chrome.storage.sync.set({ blockedSuggestions });
      }

      // Clear suggestion from session storage
      await chrome.storage.session.remove('suggestedGoLink');
      
      window.close();
    } catch (error) {
      console.error('Error blocking suggestion:', error);
    }
  });

  // Connect to service worker so it can detect when popup closes
  const port = chrome.runtime.connect({ name: 'popup' });
});


document.addEventListener('DOMContentLoaded', async () => {
  const urlInput = document.getElementById('url');
  const keywordInput = document.getElementById('keyword');
  const descriptionInput = document.getElementById('description');
  const form = document.getElementById('suggestionForm');
  const cancelBtn = document.getElementById('cancelBtn');
  const messageDiv = document.getElementById('message');
  const formView = document.getElementById('formView');
  const listView = document.getElementById('listView');
  const viewAllBtn = document.getElementById('viewAllBtn');
  const addNewBtn = document.getElementById('addNewBtn');
  const suggestionsList = document.getElementById('suggestionsList');
  const formTitle = document.getElementById('formTitle');
  const saveBtn = document.getElementById('saveBtn');
  const searchInput = document.getElementById('searchInput');
  const keywordWarning = document.getElementById('keywordWarning');

  let editingKeyword = null;
  let allSuggestions = { keys: [], map: {} };

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

  // Update warning display for a given keyword
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

  // Function to extract suggestion fields from a URL
  function extractSuggestionFields(urlString) {
    try {
      const url = new URL(urlString);
      const hostname = url.hostname;
      
      let keyword = hostname.replace('www.', '');
      keyword = keyword.split('.')[0];
      keyword = keyword.toLowerCase();
      
      const capitalizedKeyword = keyword.charAt(0).toUpperCase() + keyword.slice(1);
      const description = `Open ${capitalizedKeyword}`;
      
      return { url: urlString, keyword, description };
    } catch (error) {
      console.error('Error parsing URL:', error);
      return { url: urlString, keyword: '', description: '' };
    }
  }

  // Check if there's a pending URL from omnibox
  const { pendingUrl } = await chrome.storage.session.get('pendingUrl');
  
  if (pendingUrl) {
    // Show form view with pending URL
    showFormView();
    
    const { url, keyword, description } = extractSuggestionFields(pendingUrl);
    urlInput.value = url;
    keywordInput.value = keyword;
    descriptionInput.value = description;
    
    // Check if pre-filled keyword matches existing
    await updateKeywordWarning(keyword);
    
    descriptionInput.focus();
  } else {
    // Show list view by default
    showListView();
  }

  function showFormView(isEdit = false) {
    formView.classList.remove('hidden');
    listView.classList.add('hidden');
    
    if (isEdit) {
      formTitle.textContent = 'Edit Suggestion';
      saveBtn.textContent = 'Update';
    } else {
      formTitle.textContent = 'Add New Suggestion';
      saveBtn.textContent = 'Save';
    }
  }

  function showListView() {
    formView.classList.add('hidden');
    listView.classList.remove('hidden');
    searchInput.value = '';
    loadSuggestions();
    searchInput.focus();
  }

  async function loadSuggestions(searchTerm = '') {
    // Get all suggestions from storage
    const suggestionsMap = chrome.storage.sync.get(null);
    const suggestionKeys = Object.keys(suggestionsMap);

    // Store all suggestions for filtering
    allSuggestions = { keys: suggestionKeys, map: suggestionsMap };

    if (suggestionKeys.length === 0) {
      suggestionsList.innerHTML = '<div class="empty-state">No suggestions yet.<br>Add one using the omnibox!</div>';
      return;
    }

    // Filter suggestions based on search term
    const filteredKeys = searchTerm
      ? suggestionKeys.filter(keyword => {
          const suggestion = suggestionsMap[keyword];
          const searchLower = searchTerm.toLowerCase();
          return (
            keyword.toLowerCase().includes(searchLower) ||
            (suggestion.description && suggestion.description.toLowerCase().includes(searchLower)) ||
            suggestion.url.toLowerCase().includes(searchLower)
          );
        })
      : suggestionKeys;

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
                <button class="delete-btn" data-keyword="${keyword}">Delete</button>
              </div>
            </div>
            <div class="suggestion-description">${suggestion.description || keyword}</div>
            <div class="suggestion-url">${suggestion.url}</div>
          </div>
        `;
      })
      .join('');

    // Attach event listeners
    document.querySelectorAll('.edit-btn').forEach(btn => {
      btn.addEventListener('click', handleEdit);
    });

    document.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', handleDelete);
    });
  }

  async function handleEdit(e) {
    const keyword = e.target.dataset.keyword;
    const result = await chrome.storage.sync.get(keyword);
    const suggestion = result[keyword];

    if (suggestion) {
      editingKeyword = keyword;
      urlInput.value = suggestion.url;
      keywordInput.value = keyword;
      descriptionInput.value = suggestion.description || '';
      
      showFormView(true);
      descriptionInput.focus();
    }
  }

  async function handleDelete(e) {
    const keyword = e.target.dataset.keyword;
    
    if (!confirm(`Delete your go-to "${keyword}"?`)) {
      return;
    }

    try {
      // Remove suggestion from storage
      await chrome.storage.sync.remove(keyword);

      loadSuggestions();
    } catch (error) {
      console.error('Error deleting suggestion:', error);
    }
  }

  viewAllBtn.addEventListener('click', showListView);

  searchInput.addEventListener('input', (e) => {
    loadSuggestions(e.target.value);
  });

  addNewBtn.addEventListener('click', async () => {
    editingKeyword = null;
    form.reset();
    
    // Get the current active tab's URL
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs[0]?.url) {
        const { url, keyword, description } = extractSuggestionFields(tabs[0].url);
        urlInput.value = url;
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
      }, 1000);
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

  function showMessage(text, type) {
    messageDiv.textContent = text;
    messageDiv.className = `message ${type}`;
    
    if (type === 'success') {
      setTimeout(() => {
        messageDiv.className = 'message';
      }, 3000);
    }
  }
});

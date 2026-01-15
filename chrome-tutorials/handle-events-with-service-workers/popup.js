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

  let editingKeyword = null;
  let allSuggestions = { keys: [], map: {} };

  // Check if there's a pending URL from omnibox
  const { pendingUrl } = await chrome.storage.session.get('pendingUrl');
  
  if (pendingUrl) {
    // Show form view with pending URL
    showFormView();
    urlInput.value = pendingUrl;
    
    // Extract and suggest keyword from domain
    try {
      const url = new URL(pendingUrl);
      const hostname = url.hostname;
      
      let suggestedKeyword = hostname.replace('www.', '');
      suggestedKeyword = suggestedKeyword.split('.')[0];
      suggestedKeyword = suggestedKeyword.toLowerCase();
      
      keywordInput.value = suggestedKeyword;
    } catch (error) {
      console.error('Error parsing URL:', error);
    }
    
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
    const { suggestionKeys = [], suggestionsMap = {} } = await chrome.storage.local.get([
      'suggestionKeys',
      'suggestionsMap'
    ]);

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
    const { suggestionsMap } = await chrome.storage.local.get('suggestionsMap');
    const suggestion = suggestionsMap[keyword];

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
      const { suggestionKeys = [], suggestionsMap = {} } = await chrome.storage.local.get([
        'suggestionKeys',
        'suggestionsMap'
      ]);

      // Remove from both structures
      delete suggestionsMap[keyword];
      const updatedKeys = suggestionKeys.filter(k => k !== keyword);

      await chrome.storage.local.set({
        suggestionKeys: updatedKeys,
        suggestionsMap
      });

      loadSuggestions();
    } catch (error) {
      console.error('Error deleting suggestion:', error);
    }
  }

  viewAllBtn.addEventListener('click', showListView);

  searchInput.addEventListener('input', (e) => {
    loadSuggestions(e.target.value);
  });

  addNewBtn.addEventListener('click', () => {
    editingKeyword = null;
    form.reset();
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
      const { suggestionKeys = [], suggestionsMap = {} } = await chrome.storage.local.get([
        'suggestionKeys',
        'suggestionsMap'
      ]);

      // Check if keyword already exists (and we're not editing it)
      if (suggestionsMap[keyword] && keyword !== editingKeyword) {
        showMessage('This keyword already exists', 'error');
        return;
      }

      // If editing, remove old keyword
      if (editingKeyword && editingKeyword !== keyword) {
        delete suggestionsMap[editingKeyword];
        const index = suggestionKeys.indexOf(editingKeyword);
        if (index > -1) {
          suggestionKeys.splice(index, 1);
        }
      }

      // Add/update suggestion
      const existingData = suggestionsMap[keyword] || {};
      suggestionsMap[keyword] = {
        url,
        description: description || keyword,
        timesUsed: existingData.timesUsed || 0,
        lastUsed: existingData.lastUsed || Date.now()
      };

      // Add keyword to list if not already there
      if (!suggestionKeys.includes(keyword)) {
        suggestionKeys.unshift(keyword);
      }

      await chrome.storage.local.set({
        suggestionsMap,
        suggestionKeys
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

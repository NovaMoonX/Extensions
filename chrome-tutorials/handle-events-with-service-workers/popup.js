import { extractSuggestionFields } from './service-worker.util.js';
import { stripQueryParams } from './service-worker.util.js';

document.addEventListener('DOMContentLoaded', async () => {
  const urlInput = document.getElementById('url');
  const stripQueryParamsToggle = document.getElementById('stripQueryParamsToggle');
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
  
  // Suggestion view elements
  const suggestionPrompt = document.getElementById('suggestionPrompt');
  const previewKeyword = document.getElementById('previewKeyword');
  const previewDescription = document.getElementById('previewDescription');
  const previewUrl = document.getElementById('previewUrl');
  const createSuggestionBtn = document.getElementById('createSuggestionBtn');
  const editSuggestionBtn = document.getElementById('editSuggestionBtn');
  const cancelSuggestionBtn = document.getElementById('cancelSuggestionBtn');
  const blockSuggestionBtn = document.getElementById('blockSuggestionBtn');

  // Blocked URLs elements
  const blockedSection = document.getElementById('blockedSection');
  const blockedList = document.getElementById('blockedList');

  let editingKeyword = null;
  let allSuggestions = { keys: [], map: {} };
  let suggestedData = null;
  let originalUrlWithParams = null;

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
  const sessionData = await chrome.storage.session.get(['pendingUrl', 'suggestedGoLink']);
  const { pendingUrl, suggestedGoLink } = sessionData;
  
  if (suggestedGoLink) {
    // Show suggestion view for frequent visits
    suggestedData = suggestedGoLink;
    showSuggestionView(suggestedGoLink);
  } else if (pendingUrl) {
    // Show form view with pending URL
    showFormView();
    
    const { url, keyword, description, originalUrl } = extractSuggestionFields(pendingUrl);
    originalUrlWithParams = originalUrl;
    urlInput.value = url;
    keywordInput.value = keyword;
    descriptionInput.value = description;
    stripQueryParamsToggle.checked = true;
    
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
    
    if (isEdit) {
      formTitle.textContent = 'Edit Quick Link';
      saveBtn.textContent = 'Update';
    } else {
      formTitle.textContent = 'Add New Quick Link';
      saveBtn.textContent = 'Save';
    }
  }

  function showListView() {
    formView.classList.add('hidden');
    listView.classList.remove('hidden');
    suggestionView.classList.add('hidden');
    searchInput.value = '';
    loadSuggestions();
    loadBlockedUrls();
    searchInput.focus();
  }

  async function loadBlockedUrls() {
    const { blockedSuggestions = [] } = await chrome.storage.sync.get('blockedSuggestions');

    if (blockedSuggestions.length === 0) {
      blockedSection.classList.add('hidden');
      return;
    }

    blockedSection.classList.remove('hidden');
    blockedList.innerHTML = blockedSuggestions
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

    // Reload the blocked URLs list
    loadBlockedUrls();
  }

  async function loadSuggestions(searchTerm = '') {
    // Get all suggestions from storage
    const suggestionsMap = await chrome.storage.sync.get(null);
    let suggestionKeys = Object.keys(suggestionsMap);

    // Filter out non-suggestion keys like 'blockedSuggestions'
    suggestionKeys = suggestionKeys.filter(key => 
      key !== 'blockedSuggestions' && 
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
      originalUrlWithParams = null;
      urlInput.value = suggestion.url;
      keywordInput.value = keyword;
      descriptionInput.value = suggestion.description || '';
      stripQueryParamsToggle.checked = true;
      
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
    originalUrlWithParams = null;
    form.reset();
    stripQueryParamsToggle.checked = true;
    
    // Get the current active tab's URL
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs[0]?.url) {
        const { url, keyword, description, originalUrl } = extractSuggestionFields(tabs[0].url);
        originalUrlWithParams = originalUrl;
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
});

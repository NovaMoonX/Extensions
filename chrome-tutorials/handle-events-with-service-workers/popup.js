document.addEventListener('DOMContentLoaded', async () => {
  const urlInput = document.getElementById('url');
  const keywordInput = document.getElementById('keyword');
  const descriptionInput = document.getElementById('description');
  const form = document.getElementById('suggestionForm');
  const cancelBtn = document.getElementById('cancelBtn');
  const messageDiv = document.getElementById('message');

  // Get the URL from chrome.runtime.getBackgroundPage or use message passing
  const { pendingUrl } = await chrome.storage.session.get('pendingUrl');
  if (pendingUrl) {
    urlInput.value = pendingUrl;
    
    // Extract and suggest keyword from domain
    try {
      const url = new URL(pendingUrl);
      const hostname = url.hostname;
      
      // Extract main domain (remove www. and get the part before the first dot after removing www)
      let suggestedKeyword = hostname.replace('www.', '');
      suggestedKeyword = suggestedKeyword.split('.')[0]; // Get part before first dot
      suggestedKeyword = suggestedKeyword.toLowerCase();
      
      keywordInput.value = suggestedKeyword;
    } catch (error) {
      console.error('Error parsing URL:', error);
    }
  }

  // Focus on description input (since keyword is pre-filled)
  descriptionInput.focus();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const keyword = keywordInput.value.trim().toLowerCase();
    const description = descriptionInput.value.trim();

    if (!keyword) {
      showMessage('Keyword is required', 'error');
      return;
    }

    try {
      // Get existing suggestions
      const { suggestionKeys = [] } = await chrome.storage.local.get('suggestionKeys');
      
      // Get existing suggestions map
      const { suggestionsMap = {} } = await chrome.storage.local.get('suggestionsMap');

      // Check if keyword already exists
      if (suggestionsMap[keyword]) {
        showMessage('This keyword already exists', 'error');
        return;
      }

      // Add new suggestion with metadata
      suggestionsMap[keyword] = {
        url: urlInput.value,
        description: description || keyword,
        timesUsed: 0,
        lastUsed: Date.now()
      };

      // Add keyword to suggestions list if not already there
      if (!suggestionKeys.includes(keyword)) {
        suggestionKeys.unshift(keyword);
      }

      // Save to storage
      await chrome.storage.local.set({
        suggestionsMap,
        suggestionKeys
      });

      showMessage('Suggestion saved successfully!', 'success');

      // Close popup after brief delay
      setTimeout(() => {
        window.close();
      }, 1000);
    } catch (error) {
      console.error('Error saving suggestion:', error);
      showMessage('Error saving suggestion', 'error');
    }
  });

  cancelBtn.addEventListener('click', () => {
    window.close();
  });

  function showMessage(text, type) {
    messageDiv.textContent = text;
    messageDiv.className = `message ${type}`;
  }
});

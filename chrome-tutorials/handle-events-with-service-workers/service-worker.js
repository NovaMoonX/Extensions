import { isURL, normalizeURL } from './service-worker.util.js';

console.log('sw-omnibox.js');

const URL_GOOGLE_SEARCH = 'https://www.google.com/search?q=';

async function updateHistory(input) {
	const { suggestionKeys, suggestionsMap } = await chrome.storage.local.get(['suggestionKeys', 'suggestionsMap']);

	// Update the suggestion's metadata
	if (suggestionsMap[input]) {
		suggestionsMap[input].timesUsed = (suggestionsMap[input].timesUsed || 0) + 1;
		suggestionsMap[input].lastUsed = Date.now();
	}

	// Move to front of suggestions list
	const updatedKeys = suggestionKeys.filter((key) => key !== input);
	updatedKeys.unshift(input);

	return chrome.storage.local.set({
		suggestionKeys: updatedKeys,
		suggestionsMap,
	});
}

// Save default API suggestions
chrome.runtime.onInstalled.addListener(({ reason }) => {
	if (reason === 'install') {
		chrome.storage.local.set({
			suggestionKeys: [],
			suggestionsMap: {},
		});
	}
});

// Display the suggestions after user starts typing, following the keyword "MDD"
chrome.omnibox.onInputChanged.addListener(async (input, suggest) => {
	await chrome.omnibox.setDefaultSuggestion({
		description: 'Enter a new link or choose from existing options',
	});

	// Get both default and custom suggestions
	const { suggestionKeys, suggestionsMap } = await chrome.storage.local.get(['suggestionKeys', 'suggestionsMap']);

	const suggestions = suggestionKeys.map((api) => {
		return { content: api, description: suggestionsMap[api]?.description || api };
	});
	const filteredSuggestions = suggestions.filter(
		(suggestion) =>
			suggestion.content.toLowerCase().includes(input.toLowerCase()) ||
			suggestion.description.toLowerCase().includes(input.toLowerCase())
	);

  if (filteredSuggestions.length === 0) {
    await chrome.omnibox.setDefaultSuggestion({
      description: 'No matching go-to links. Enter a URL to create a new one or non-URL to simply search Google.',
    });
  }

	suggest(filteredSuggestions);
});

// Called after user accepts an option - Open the page of the chosen resource
chrome.omnibox.onInputEntered.addListener(async (input) => {
	// Get custom suggestions from storage
	const { suggestionsMap } = await chrome.storage.local.get('suggestionsMap');

	let url;

	// Check if input matches an existing suggestion
	if (suggestionsMap[input]) {
		url = suggestionsMap[input].url;
		updateHistory(input);
	} else if (isURL(input)) {
		// Input is a URL - open it and show popup for creating suggestion
		url = normalizeURL(input);
		chrome.tabs.create({ url });

		// Store URL temporarily and open popup
		await chrome.storage.session.set({ pendingUrl: url });
		chrome.action.openPopup();
		return;
	} else {
		// Treat as Google search
		url = `${URL_GOOGLE_SEARCH}${input}`;
	}

	chrome.tabs.create({ url });
});

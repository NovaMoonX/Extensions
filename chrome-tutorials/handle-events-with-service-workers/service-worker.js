import { isURL, normalizeURL } from './service-worker.util.js';

console.log('sw-omnibox.js');

const URL_GOOGLE_SEARCH = 'https://www.google.com/search?q=';
const SUGGESTIONS_PROMPT_EXISTS = 'Select a go-to link or enter a new URL to create one.';
const SUGGESTIONS_PROMPT_NONE =
	'No go-to links yet. Enter a URL to create a new one or non-URL to simply search Google.';

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

chrome.omnibox.onInputStarted.addListener(async () => {
	await chrome.omnibox.setDefaultSuggestion({
		description: SUGGESTIONS_PROMPT_EXISTS,
	});
});

// Display the suggestions after user starts typing, following the keyword "gt"
chrome.omnibox.onInputChanged.addListener(async (input, suggest) => {
	const { suggestionKeys, suggestionsMap } = await chrome.storage.local.get(['suggestionKeys', 'suggestionsMap']);

	const suggestions = suggestionKeys.map((api) => {
		return { content: api, description: suggestionsMap[api]?.description || api };
	});

	const filteredSuggestions = suggestions.filter(
		(suggestion) =>
			suggestion.content.toLowerCase().includes(input.toLowerCase()) ||
			suggestion.description.toLowerCase().includes(input.toLowerCase())
	);

	// Check if there's an exact match (Chrome omnibox removes exact matches from suggestions)
	const exactMatch = filteredSuggestions.find(
		(suggestion) => suggestion.content.toLowerCase() === input.toLowerCase()
	);

	if (exactMatch) {
		// Set exact match as default suggestion
		await chrome.omnibox.setDefaultSuggestion({
			description: exactMatch.description,
		});
		// Remove exact match from suggestions list to avoid duplication
		const otherSuggestions = filteredSuggestions.filter(
			(suggestion) => suggestion.content.toLowerCase() !== input.toLowerCase()
		);
		suggest(otherSuggestions);
	} else if (filteredSuggestions.length === 0) {
		await chrome.omnibox.setDefaultSuggestion({
			description: SUGGESTIONS_PROMPT_NONE,
		});
		suggest([]);
	} else {
		await chrome.omnibox.setDefaultSuggestion({
			description: SUGGESTIONS_PROMPT_EXISTS,
		});
		suggest(filteredSuggestions);
	}
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

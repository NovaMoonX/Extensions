import { isURL, normalizeURL } from './service-worker.util.js';

console.log('sw-omnibox.js');

const URL_GOOGLE_SEARCH = 'https://www.google.com/search?q=';
const SUGGESTIONS_PROMPT_EXISTS = 'Select a go-to link or enter a new URL to create one.';
const SUGGESTIONS_PROMPT_NONE =
	'No go-to links yet. Enter a URL to create a new one or non-URL to simply search Google.';

async function updateHistory(input) {
	const suggestion = await chrome.storage.sync.get(input);

	// Update the suggestion's metadata
	if (suggestion[input]) {
		suggestion[input].timesUsed = (suggestion[input].timesUsed || 0) + 1;
		suggestion[input].lastUsed = Date.now();
		await chrome.storage.sync.set({ [input]: suggestion[input] });
	}
}

// Save default API suggestions
chrome.runtime.onInstalled.addListener(({ reason }) => {
	if (reason === 'install') {
		// No initialization needed - suggestions are stored directly
	}
});

chrome.omnibox.onInputStarted.addListener(async () => {
	await chrome.omnibox.setDefaultSuggestion({
		description: SUGGESTIONS_PROMPT_EXISTS,
	});
});

// Display the suggestions after user starts typing, following the keyword "gt"
chrome.omnibox.onInputChanged.addListener(async (input, suggest) => {
	// Get all suggestions from storage
	const allItems = await chrome.storage.sync.get(null);
	const suggestionKeys = Object.keys(allItems);

	const suggestions = suggestionKeys.map((keyword) => {
		const item = allItems[keyword];
		const description = item?.description || '';
		const url = item?.url ? `<dim> • <url>${item.url}</url></dim>` : '';
		
		// Highlight matched parts of keyword and description
		const highlightMatches = (text) => {
			const regex = new RegExp(`(${input})`, 'gi');
			return text.replace(regex, '<match>$1</match>');
		};
		
		const highlightedKeyword = highlightMatches(keyword);
		const highlightedDescription = highlightMatches(description);
		
		return { 
			content: keyword, 
			description: `${highlightedKeyword} - ${highlightedDescription}${url}`
		};
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
	// Get custom suggestion
	const result = await chrome.storage.sync.get(input);

	let url;

	// Check if input matches an existing suggestion
	if (result[input]) {
		url = result[input].url;
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

// Handle keyboard shortcut command
chrome.commands.onCommand.addListener(async (command) => {
	if (command === 'add-suggestion') {
		// Get the current active tab
		const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
		if (tabs[0]?.url) {
			// Store URL in session and open popup
			await chrome.storage.session.set({ pendingUrl: tabs[0].url });
			chrome.action.openPopup();
		}
	}
});

import {
	isURL,
	normalizeURL,
	stripQueryParams,
	hasFrequentVisits,
	extractSuggestionFieldsFromTitle,
} from './service-worker.util.js';

const URL_GOOGLE_SEARCH = 'https://www.google.com/search?q=';
const SUGGESTIONS_PROMPT_EXISTS = 'Type to select a quick link or enter a new URL to create one.';
const SUGGESTIONS_PROMPT_NONE =
	'No quick links yet. Enter a URL to create a new one or non-URL to simply search Google.';

// Returns true if every character of input appears in keyword in order (subsequence match)
function fuzzyMatchKeyword(keyword, input) {
	let inputIndex = 0;
	for (let keywordIndex = 0; keywordIndex < keyword.length && inputIndex < input.length; keywordIndex++) {
		if (keyword[keywordIndex] === input[inputIndex]) inputIndex++;
	}
	return inputIndex === input.length;
}

// Wraps each matched character in <match> tags for omnibox highlighting
function fuzzyHighlightKeyword(keyword, inputLower) {
	const keywordLower = keyword.toLowerCase();
	let result = '';
	let inputIndex = 0;
	for (let keywordIndex = 0; keywordIndex < keyword.length; keywordIndex++) {
		if (inputIndex < inputLower.length && keywordLower[keywordIndex] === inputLower[inputIndex]) {
			result += `<match>${keyword[keywordIndex]}</match>`;
			inputIndex++;
		} else {
			result += keyword[keywordIndex];
		}
	}
	return result;
}

async function updateHistory(input) {
	const suggestion = await chrome.storage.sync.get(input);

	// Update the suggestion's metadata
	if (suggestion[input]) {
		suggestion[input].timesUsed = (suggestion[input].timesUsed || 0) + 1;
		suggestion[input].lastUsed = Date.now();
		await chrome.storage.sync.set({ [input]: suggestion[input] });
	}
}

async function openLink(url) {
	const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
	if (tabs[0]) {
		chrome.tabs.update(tabs[0].id, { url });
	} else {
		chrome.tabs.create({ url });
	}
}

// Returns true if any saved quick link already points to the given URL.
// Normalizes both sides (strips query params, collapses trailing slashes) so that
// links saved with or without query params are still matched correctly.
async function urlHasExistingLink(url) {
	const normalizeForComparison = (rawUrl) => {
		if (!rawUrl || typeof rawUrl !== 'string') return null;
		return stripQueryParams(rawUrl).replace(/\/+$/, '');
	};

	const target = normalizeForComparison(url);
	if (!target) return false;

	const allLinks = await chrome.storage.sync.get(null);
	return Object.values(allLinks).some((item) => {
		if (!item || typeof item !== 'object' || Array.isArray(item)) return false;
		return normalizeForComparison(item.url) === target;
	});
}

chrome.omnibox.onInputStarted.addListener(async () => {
	await chrome.omnibox.setDefaultSuggestion({
		description: SUGGESTIONS_PROMPT_EXISTS,
	});
});

// Display the suggestions after user starts typing, following the keyword "gt"
chrome.omnibox.onInputChanged.addListener(async (input, suggest) => {
	// Remove any stored top suggestion from session
	await chrome.storage.session.remove('topSuggestion');

	const trimmedInput = input.trim();
	if (trimmedInput === '') {
		// Show prompt when no input
		await chrome.omnibox.setDefaultSuggestion({
			description: SUGGESTIONS_PROMPT_EXISTS,
		});
		suggest([]);
		return;
	}

	// Get all suggestions from storage
	const allItems = await chrome.storage.sync.get(null);
	const suggestionKeys = Object.keys(allItems);

	const formatSuggestions = (items) => {
		return items.map((item) => ({
			content: item.content,
			description: item.description,
		}));
	};

	const highlightMatches = (text) => {
		const regex = new RegExp(`(${trimmedInput})`, 'gi');
		return text.replace(regex, '<match>$1</match>');
	};

	const filteredSuggestions = suggestionKeys
		.map((keyword) => {
			const item = allItems[keyword];
			// Skip non-quick-link keys (blockedSuggestions, settings, visit history, etc.)
			if (!item || typeof item !== 'object' || Array.isArray(item) || !item.url) {
				return null;
			}

			const description = item.description || '';
			const escapedUrl = item.url.replace(/&/g, '&amp;');
			const urlDim = `<dim> • <url>${escapedUrl}</url></dim>`;

			const keywordLower = keyword.toLowerCase();
			const inputLower = trimmedInput.toLowerCase();
			let matchScore = 0;
			let highlightedKeyword;
			let highlightedDescription;

			if (keywordLower.startsWith(inputLower)) {
				matchScore = 100;
				highlightedKeyword = highlightMatches(keyword);
				highlightedDescription = highlightMatches(description);
			} else if (keywordLower.includes(inputLower)) {
				matchScore = 50;
				highlightedKeyword = highlightMatches(keyword);
				highlightedDescription = highlightMatches(description);
			} else if (description.toLowerCase().includes(inputLower)) {
				matchScore = 25;
				highlightedKeyword = keyword;
				highlightedDescription = highlightMatches(description);
			} else if (fuzzyMatchKeyword(keywordLower, inputLower)) {
				matchScore = 10;
				highlightedKeyword = fuzzyHighlightKeyword(keyword, inputLower);
				highlightedDescription = description;
			}

			if (matchScore === 0) return null;

			return {
				content: keyword,
				description: `${highlightedKeyword} - ${highlightedDescription}${urlDim}`,
				matchScore,
			};
		})
		.filter(Boolean);

	// Sort by match score (highest first), then by usage frequency
	filteredSuggestions.sort((a, b) => {
		if (b.matchScore !== a.matchScore) {
			return b.matchScore - a.matchScore;
		}
		// If same match score, prefer more recently or frequently used
		const aItem = allItems[a.content];
		const bItem = allItems[b.content];
		const aScore = (aItem?.timesUsed || 0) + (aItem?.lastUsed || 0) / 1000000000;
		const bScore = (bItem?.timesUsed || 0) + (bItem?.lastUsed || 0) / 1000000000;
		return bScore - aScore;
	});

	// Check if there's an exact match (Chrome omnibox removes exact matches from suggestions)
	const exactMatch = filteredSuggestions.find(
		(suggestion) => suggestion.content.toLowerCase() === trimmedInput.toLowerCase(),
	);

	if (exactMatch) {
		// Set exact match as default suggestion
		await chrome.omnibox.setDefaultSuggestion({
			description: exactMatch.description,
		});
		// Remove exact match from suggestions list to avoid duplication
		const otherSuggestions = filteredSuggestions.filter(
			(suggestion) => suggestion.content.toLowerCase() !== trimmedInput.toLowerCase(),
		);
		suggest(formatSuggestions(otherSuggestions));
	} else if (filteredSuggestions.length === 0) {
		await chrome.omnibox.setDefaultSuggestion({
			description: SUGGESTIONS_PROMPT_NONE,
		});
		suggest([]);
	} else {
		// Show top match as default suggestion - Enter navigates to it
		const topMatch = filteredSuggestions[0];
		await chrome.omnibox.setDefaultSuggestion({
			description: topMatch.description,
		});
		// Store top suggestion in session for Enter key handler
		await chrome.storage.session.set({
			topSuggestion: {
				content: topMatch.content,
				url: allItems[topMatch.content]?.url,
			},
		});
		// Remove top match from suggestions to avoid duplication
		const otherSuggestions = filteredSuggestions.slice(1);
		suggest(formatSuggestions(otherSuggestions));
	}
});

// Called after user accepts an option - Open the page of the chosen resource
chrome.omnibox.onInputEntered.addListener(async (input) => {
	const trimmedInput = input.trim();
	if (trimmedInput === '') {
		return;
	}

	// First: check if input directly matches a saved quick link
	// (handles the case where the user clicks a non-top suggestion from the dropdown)
	const result = await chrome.storage.sync.get(trimmedInput);
	if (result[trimmedInput]) {
		await chrome.storage.session.remove('topSuggestion');
		updateHistory(trimmedInput);
		await openLink(result[trimmedInput].url);
		return;
	}

	// Second: check if there is a stored top suggestion
	// (handles the case where the user presses Enter after typing a partial keyword)
	const sessionData = await chrome.storage.session.get('topSuggestion');
	const topSuggestion = sessionData.topSuggestion;

	if (topSuggestion) {
		await chrome.storage.session.remove('topSuggestion');
		updateHistory(topSuggestion.content);
		await openLink(topSuggestion.url);
		return;
	}

	let url;

	// Check if input matches an existing suggestion
	if (result[trimmedInput]) {
		url = result[trimmedInput].url;
		updateHistory(trimmedInput);
	} else if (isURL(trimmedInput)) {
		// Input is a URL - open it and show popup for creating suggestion
		url = normalizeURL(trimmedInput);
		await openLink(url);

		// Store URL temporarily and open popup
		await chrome.storage.session.set({ pendingUrl: url });
		chrome.action.openPopup();
		return;
	} else {
		// Treat as Google search
		url = `${URL_GOOGLE_SEARCH}${trimmedInput}`;
	}

	await openLink(url);
});

// Handle keyboard shortcut command
chrome.commands.onCommand.addListener(async (command) => {
	if (command === 'add-suggestion') {
		// Get the current active tab
		const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
		if (tabs[0]?.url) {
			// Store URL and tab title in session and open popup
			await chrome.storage.session.set({
				pendingUrl: tabs[0].url,
				pendingTitle: tabs[0].title || '',
			});
			chrome.action.openPopup();
		}
	}
});

// Track URL visits to detect frequent browsing patterns
// Use webNavigation API to reliably detect only new navigations
chrome.webNavigation.onCommitted.addListener(async (details) => {
	const { tabId, url, transitionType, transitionQualifiers } = details;

	// Only track main frame navigations (not iframes)
	if (details.frameId !== 0) {
		return;
	}

	// Skip reloads, back/forward navigation, and other non-new navigations
	if (
		transitionType === 'reload' ||
		transitionType === 'auto_subframe' ||
		transitionQualifiers.includes('forward_back')
	) {
		return;
	}

	// Strip query parameters from URL
	const urlWithoutParams = stripQueryParams(url);

	// Skip chrome:// and other internal URLs
	if (urlWithoutParams.startsWith('chrome://') || urlWithoutParams.startsWith('chrome-extension://')) {
		return;
	}

	// Skip Google search results pages and localhost/loopback addresses
	try {
		const urlObj = new URL(url);
		const hostname = urlObj.hostname;
		if ((hostname === 'google.com' || hostname.endsWith('.google.com')) && 
		    (urlObj.pathname.includes('/search') || urlObj.searchParams.has('q'))) {
			return;
		}
		// Skip localhost, loopback addresses, and internal quick-link hostnames — never suggest quick links for local dev servers
		if (
			hostname === 'localhost' ||
			hostname === '127.0.0.1' ||
			hostname === '::1' ||
			hostname === '0.0.0.0' ||
			hostname === 'ql'
		) {
			return;
		}
	} catch {
		// Invalid URL, skip
		return;
	}

	// Get existing visit history for this URL
	const historyKey = `visit_history_${urlWithoutParams}`;
	const result = await chrome.storage.local.get(historyKey);
	const visitTimestamps = result[historyKey] || [];

	// Add current timestamp
	visitTimestamps.push(Date.now());

	// Clean up old timestamps (older than 24 hours)
	const twentyFourHours = 24 * 60 * 60 * 1000;
	const now = Date.now();
	const recentVisits = visitTimestamps.filter((timestamp) => now - timestamp <= twentyFourHours);

	// Save updated visit history
	await chrome.storage.local.set({ [historyKey]: recentVisits });

	// Check if URL has been visited frequently
	if (hasFrequentVisits(recentVisits)) {
		console.log(`Frequent visits detected for: ${urlWithoutParams}`);

		// Check if auto-suggestions are enabled in user settings (default: enabled)
		const { settings = {} } = await chrome.storage.sync.get('settings');
		if (settings.autoSuggestionsEnabled === false) {
			return;
		}

		// Check if URL is blocked from suggestions
		const { blockedSuggestions = [] } = await chrome.storage.sync.get('blockedSuggestions');
		if (blockedSuggestions.includes(urlWithoutParams)) {
			// User blocked suggestions for this URL
			return;
		}

		// Check if we already suggested this URL or if it already has a go-link
		const suggestionKey = `suggested_${urlWithoutParams}`;
		const alreadySuggested = await chrome.storage.local.get(suggestionKey);

		if (alreadySuggested[suggestionKey]) {
			// Already suggested this URL, don't suggest again
			return;
		}

		// Check if any existing quick link already points to this URL
		if (await urlHasExistingLink(urlWithoutParams)) {
			// User already has a quick link for this URL — mark as suggested so we stop checking
			await chrome.storage.local.set({ [suggestionKey]: true });
			return;
		}

		// Defer to onCompleted so the tab title is available (it isn't at onCommitted time).
		// Pass the suggestionKey so onCompleted can mark after the keyword check.
		await chrome.storage.session.set({
			[`pendingAutoSuggestion_${tabId}`]: { url: urlWithoutParams, suggestionKey },
		});
	}
});

// Show the auto-suggestion popup once the page has fully loaded so the tab title is correct.
chrome.webNavigation.onCompleted.addListener(async (details) => {
	// Only handle main frame navigations (not iframes)
	if (details.frameId !== 0) {
		return;
	}

	const pendingKey = `pendingAutoSuggestion_${details.tabId}`;
	const sessionResult = await chrome.storage.session.get(pendingKey);
	const pending = sessionResult[pendingKey];

	if (!pending) {
		return;
	}

	// Normalize both URLs the same way before comparing so that differences
	// in trailing slashes or port defaults don't cause a false mismatch.
	const normalizeForCompare = (url) => {
		try {
			const u = new URL(url);
			return `${u.origin}${u.pathname.replace(/\/+$/, '')}`;
		} catch {
			return url;
		}
	};
	if (normalizeForCompare(stripQueryParams(details.url)) !== normalizeForCompare(pending.url)) {
		// URL doesn't match — leave the pending entry so a later onCompleted can pick it up.
		return;
	}

	// URL matched — clean up the pending marker now that we're committed to handling it.
	await chrome.storage.session.remove(pendingKey);

	// Get the tab title now that the page has loaded
	let tab;
	try {
		tab = await chrome.tabs.get(details.tabId);
	} catch {
		return;
	}

	const { keyword, description } = extractSuggestionFieldsFromTitle(tab.title, pending.url);

	// Safety-net check: if a quick link for this URL was saved after onCommitted ran,
	// don't suggest a duplicate.
	if (await urlHasExistingLink(pending.url)) {
		await chrome.storage.local.set({ [pending.suggestionKey]: true });
		return;
	}

	// Check if keyword already exists — if so, mark as suggested and skip.
	// (The keyword is now title-based; if it conflicts we don't suggest rather
	//  than overwriting the user's existing link.)
	const existing = await chrome.storage.sync.get(keyword);
	if (existing[keyword]) {
		await chrome.storage.local.set({ [pending.suggestionKey]: true });
		return;
	}

	// Mark as suggested so we don't trigger the popup for this URL again.
	await chrome.storage.local.set({ [pending.suggestionKey]: true });

	// Store suggestion in session and open popup
	await chrome.storage.session.set({
		suggestedGoLink: {
			url: pending.url,
			keyword,
			description,
		},
	});

	// Open popup to show suggestion
	chrome.action.openPopup();
});

// Clean up stale pending auto-suggestion entries when a tab is closed so that session
// storage doesn't accumulate entries for navigations that never reached onCompleted.
chrome.tabs.onRemoved.addListener(async (tabId) => {
	await chrome.storage.session.remove(`pendingAutoSuggestion_${tabId}`);
});

// Handle ql/<keyword> navigation pattern so users can type "ql/keyword" in the address bar
// to jump directly to a saved quick link without the omnibox Tab trigger.
// Covers two cases:
//   1. Chrome navigates to http://ql/<keyword> (local-hostname interpretation)
//   2. Chrome searches Google for "ql/<keyword>" (most common: no TLD → search)
chrome.webNavigation.onBeforeNavigate.addListener(async (details) => {
	// Only handle main frame navigations
	if (details.frameId !== 0) return;

	let keyword = null;

	try {
		const navUrl = new URL(details.url);

		// Case 1: Direct navigation to http://ql/<keyword>
		if (navUrl.hostname === 'ql') {
			const path = navUrl.pathname.replace(/^\/+/, '').trim();
			if (path) keyword = path;
		}
		// Case 2: Google search whose query is exactly "ql/<keyword>"
		else if (
			(navUrl.hostname === 'www.google.com' || navUrl.hostname === 'google.com') &&
			navUrl.pathname === '/search'
		) {
			const query = navUrl.searchParams.get('q') || '';
			const match = query.match(/^ql\/(\S+)$/);
			if (match) keyword = match[1];
		}
	} catch {
		return;
	}

	if (!keyword) return;

	// Look up the keyword in storage and redirect if found
	const result = await chrome.storage.sync.get(keyword);
	if (result[keyword]) {
		updateHistory(keyword);
		if (typeof details.tabId === 'number' && details.tabId >= 0) {
			chrome.tabs.update(details.tabId, { url: result[keyword].url });
		}
	}
});

// Detect when popup closes and clean up session storage
chrome.runtime.onConnect.addListener((port) => {
	if (port.name === 'popup') {
		port.onDisconnect.addListener(async () => {
			// Clear any pending session data when popup closes
			await chrome.storage.session.remove(['pendingUrl', 'pendingTitle', 'suggestedGoLink']);
		});
	}
});

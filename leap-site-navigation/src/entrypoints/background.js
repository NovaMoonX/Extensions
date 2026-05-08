import { defineBackground } from 'wxt/utils/define-background';
import {
	isURL,
	normalizeURL,
	stripQueryParams,
	hasFrequentVisits,
	extractSuggestionFieldsFromTitle,
} from '../utils/url.js';

export default defineBackground(() => {
	const URL_GOOGLE_SEARCH = 'https://www.google.com/search?q=';
	const OMNIBOX_KEYWORD = 'lp';
	const SUGGESTIONS_PROMPT_EXISTS = 'Type to select a lily pad or enter a new URL to create one.';
	const SUGGESTIONS_PROMPT_NONE =
		'No lily pads yet. Enter a URL to create a new one or non-URL to simply search Google.';

	// Migrate legacy non-keyword storage keys to the __ prefix convention so that
	// user-defined keywords can never accidentally overwrite internal app state.
	// Also migrates from Quick Links (old extension) format.
	// Safe to run multiple times: if the new key already exists it is preserved,
	// and the old key is always removed after migration.
	async function migrateStorageKeys() {
		const allData = await chrome.storage.sync.get(null);
		const keysToSet = {};
		const keysToRemove = [];

		// blockedSuggestions → __blockedSuggestions
		if ('blockedSuggestions' in allData) {
			if (!('__blockedSuggestions' in allData)) {
				keysToSet['__blockedSuggestions'] = allData['blockedSuggestions'];
			}
			keysToRemove.push('blockedSuggestions');
		}

		// settings → __settings
		if ('settings' in allData) {
			if (!('__settings' in allData)) {
				keysToSet['__settings'] = allData['settings'];
			}
			keysToRemove.push('settings');
		}

		// note_<keyword> → __note_<keyword>
		for (const key of Object.keys(allData)) {
			if (key.startsWith('note_')) {
				const newKey = `__${key}`;
				if (!(newKey in allData)) {
					keysToSet[newKey] = allData[key];
				}
				keysToRemove.push(key);
			}
		}

		if (Object.keys(keysToSet).length > 0) {
			await chrome.storage.sync.set(keysToSet);
		}
		if (keysToRemove.length > 0) {
			await chrome.storage.sync.remove(keysToRemove);
		}
	}

	// Returns the index of the first matched character if input is a subsequence of keyword,
	// or -1 if it is not a match.
	function fuzzyMatchKeyword(keyword, input) {
		if (input.length === 0) return -1;
		let inputIndex = 0;
		let firstMatchIndex = -1;
		for (let keywordIndex = 0; keywordIndex < keyword.length && inputIndex < input.length; keywordIndex++) {
			if (keyword[keywordIndex] === input[inputIndex]) {
				if (firstMatchIndex === -1) firstMatchIndex = keywordIndex;
				inputIndex++;
			}
		}
		return inputIndex === input.length ? firstMatchIndex : -1;
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

	// Returns true if any saved lily pad already points to the given URL.
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

	// Returns the keyword of the first saved lily pad that matches the given URL, or null.
	async function findLilyPadKeywordForUrl(url) {
		const normalizeForComparison = (rawUrl) => {
			if (!rawUrl || typeof rawUrl !== 'string') return null;
			return stripQueryParams(rawUrl).replace(/\/+$/, '');
		};

		const target = normalizeForComparison(url);
		if (!target) return null;

		const allLinks = await chrome.storage.sync.get(null);
		for (const [key, item] of Object.entries(allLinks)) {
			if (!item || typeof item !== 'object' || Array.isArray(item) || !item.url) continue;
			if (normalizeForComparison(item.url) === target) return key;
		}
		return null;
	}

	// --- Omnibox ---

	chrome.omnibox.onInputStarted.addListener(async () => {
		await chrome.omnibox.setDefaultSuggestion({
			description: SUGGESTIONS_PROMPT_EXISTS,
		});
	});

	chrome.omnibox.onInputChanged.addListener(async (input, suggest) => {
		await chrome.storage.session.remove('topSuggestion');

		const trimmedInput = input.trim();
		if (trimmedInput === '') {
			await chrome.omnibox.setDefaultSuggestion({
				description: SUGGESTIONS_PROMPT_EXISTS,
			});
			suggest([]);
			return;
		}

		const allItems = await chrome.storage.sync.get(null);
		const suggestionKeys = Object.keys(allItems).filter((k) => !k.startsWith('__'));

		const formatSuggestions = (items) =>
			items.map((item) => ({ content: item.content, description: item.description }));

		const highlightMatches = (text) => {
			const regex = new RegExp(`(${trimmedInput})`, 'gi');
			return text.replace(regex, '<match>$1</match>');
		};

		const filteredSuggestions = suggestionKeys
			.map((keyword) => {
				const item = allItems[keyword];
				if (!item || typeof item !== 'object' || Array.isArray(item) || !item.url) {
					return null;
				}

				const description = item.description || '';
				const escapedUrl = item.url.replace(/&/g, '&amp;');
				const urlDim = `<dim> • <url>${escapedUrl}</url></dim>`;

				const keywordLower = keyword.toLowerCase();
				const inputLower = trimmedInput.toLowerCase();
				let matchScore = 0;
				let fuzzyMatchStart = -1;
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
				} else {
					fuzzyMatchStart = fuzzyMatchKeyword(keywordLower, inputLower);
					if (fuzzyMatchStart !== -1) {
						matchScore = 10;
						highlightedKeyword = fuzzyHighlightKeyword(keyword, inputLower);
						highlightedDescription = description;
					}
				}

				if (matchScore === 0) return null;

				return {
					content: keyword,
					description: `${highlightedKeyword} - ${highlightedDescription}${urlDim}`,
					matchScore,
					fuzzyMatchStart,
				};
			})
			.filter(Boolean);

		filteredSuggestions.sort((a, b) => {
			if (b.matchScore !== a.matchScore) return b.matchScore - a.matchScore;
			if (a.matchScore === 10 && a.fuzzyMatchStart !== b.fuzzyMatchStart) {
				return a.fuzzyMatchStart - b.fuzzyMatchStart;
			}
			const aItem = allItems[a.content];
			const bItem = allItems[b.content];
			const aScore = (aItem?.timesUsed || 0) + (aItem?.lastUsed || 0) / 1000000000;
			const bScore = (bItem?.timesUsed || 0) + (bItem?.lastUsed || 0) / 1000000000;
			return bScore - aScore;
		});

		const exactMatch = filteredSuggestions.find(
			(suggestion) => suggestion.content.toLowerCase() === trimmedInput.toLowerCase(),
		);

		if (exactMatch) {
			await chrome.omnibox.setDefaultSuggestion({ description: exactMatch.description });
			const otherSuggestions = filteredSuggestions.filter(
				(suggestion) => suggestion.content.toLowerCase() !== trimmedInput.toLowerCase(),
			);
			suggest(formatSuggestions(otherSuggestions));
		} else if (filteredSuggestions.length === 0) {
			await chrome.omnibox.setDefaultSuggestion({ description: SUGGESTIONS_PROMPT_NONE });
			suggest([]);
		} else {
			const topMatch = filteredSuggestions[0];
			await chrome.omnibox.setDefaultSuggestion({ description: topMatch.description });
			await chrome.storage.session.set({
				topSuggestion: {
					content: topMatch.content,
					url: allItems[topMatch.content]?.url,
				},
			});
			const otherSuggestions = filteredSuggestions.slice(1);
			suggest(formatSuggestions(otherSuggestions));
		}
	});

	chrome.omnibox.onInputEntered.addListener(async (input) => {
		const trimmedInput = input.trim();
		if (trimmedInput === '') return;

		const result = await chrome.storage.sync.get(trimmedInput);
		if (result[trimmedInput]) {
			await chrome.storage.session.remove('topSuggestion');
			updateHistory(trimmedInput);
			await openLink(result[trimmedInput].url);
			return;
		}

		const sessionData = await chrome.storage.session.get('topSuggestion');
		const topSuggestion = sessionData.topSuggestion;

		if (topSuggestion) {
			await chrome.storage.session.remove('topSuggestion');
			updateHistory(topSuggestion.content);
			await openLink(topSuggestion.url);
			return;
		}

		let url;

		if (result[trimmedInput]) {
			url = result[trimmedInput].url;
			updateHistory(trimmedInput);
		} else if (isURL(trimmedInput)) {
			url = normalizeURL(trimmedInput);
			await openLink(url);
			await chrome.storage.session.set({ pendingUrl: url });
			chrome.action.openPopup();
			return;
		} else {
			url = `${URL_GOOGLE_SEARCH}${trimmedInput}`;
		}

		await openLink(url);
	});

	// --- Commands ---

	chrome.commands.onCommand.addListener(async (command) => {
		if (command === 'add-lily-pad') {
			const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
			if (!tabs[0]?.url) return;

			const existingKeyword = await findLilyPadKeywordForUrl(tabs[0].url);
			if (existingKeyword) {
				await chrome.storage.session.set({ openDetailForKeyword: existingKeyword });
			} else {
				await chrome.storage.session.set({
					pendingUrl: tabs[0].url,
					pendingTitle: tabs[0].title || '',
				});
			}
			chrome.action.openPopup();
		} else if (command === 'open-leaflets') {
			const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
			if (!tabs[0]?.url) return;

			const keyword = await findLilyPadKeywordForUrl(tabs[0].url);
			if (keyword) {
				await chrome.storage.session.set({ openNotesForKeyword: keyword });
			} else {
				await chrome.storage.session.set({ openNotesForCurrentPage: true });
			}
			chrome.action.openPopup();
		}
	});

	// --- Web Navigation: visit tracking and auto-suggestions ---

	chrome.webNavigation.onCommitted.addListener(async (details) => {
		const { tabId, url, transitionType, transitionQualifiers } = details;

		if (details.frameId !== 0) return;

		if (
			transitionType === 'reload' ||
			transitionType === 'auto_subframe' ||
			transitionQualifiers.includes('forward_back')
		) {
			return;
		}

		const urlWithoutParams = stripQueryParams(url);

		if (urlWithoutParams.startsWith('chrome://') || urlWithoutParams.startsWith('chrome-extension://')) {
			return;
		}

		try {
			const urlObj = new URL(url);
			const hostname = urlObj.hostname;
			if (
				(hostname === 'google.com' || hostname.endsWith('.google.com')) &&
				(urlObj.pathname.includes('/search') || urlObj.searchParams.has('q'))
			) {
				return;
			}
			if (
				hostname === 'localhost' ||
				hostname === '127.0.0.1' ||
				hostname === '::1' ||
				hostname === '0.0.0.0' ||
				hostname === OMNIBOX_KEYWORD
			) {
				return;
			}
		} catch {
			return;
		}

		const historyKey = `visit_history_${urlWithoutParams}`;
		const result = await chrome.storage.local.get(historyKey);
		const visitTimestamps = result[historyKey] || [];

		visitTimestamps.push(Date.now());

		const twentyFourHours = 24 * 60 * 60 * 1000;
		const now = Date.now();
		const recentVisits = visitTimestamps.filter((timestamp) => now - timestamp <= twentyFourHours);

		await chrome.storage.local.set({ [historyKey]: recentVisits });

		if (hasFrequentVisits(recentVisits)) {
			const { __settings: settings = {} } = await chrome.storage.sync.get('__settings');
			if (settings.autoSuggestionsEnabled === false) return;

			const { __blockedSuggestions: blockedSuggestions = [] } = await chrome.storage.sync.get('__blockedSuggestions');
			if (blockedSuggestions.includes(urlWithoutParams)) return;

			const suggestionKey = `suggested_${urlWithoutParams}`;
			const alreadySuggested = await chrome.storage.local.get(suggestionKey);
			if (alreadySuggested[suggestionKey]) return;

			if (await urlHasExistingLink(urlWithoutParams)) {
				await chrome.storage.local.set({ [suggestionKey]: true });
				return;
			}

			await chrome.storage.session.set({
				[`pendingAutoSuggestion_${tabId}`]: { url: urlWithoutParams, suggestionKey },
			});
		}
	});

	// Show the auto-suggestion popup once the page has fully loaded so the tab title is correct.
	chrome.webNavigation.onCompleted.addListener(async (details) => {
		if (details.frameId !== 0) return;

		const pendingKey = `pendingAutoSuggestion_${details.tabId}`;
		const sessionResult = await chrome.storage.session.get(pendingKey);
		const pending = sessionResult[pendingKey];

		if (!pending) {
			// Check for auto-open leaflets
			const url = details.url;
			if (url.startsWith('chrome://') || url.startsWith('chrome-extension://')) return;

			const { __settings: settings = {} } = await chrome.storage.sync.get('__settings');
			if (settings.autoOpenNotes === false) return;

			const keyword = await findLilyPadKeywordForUrl(url);
			if (!keyword) return;

			const noteKey = `__note_${keyword}`;
			const noteResult = await chrome.storage.sync.get(noteKey);
			if (!noteResult[noteKey]) return;

			await chrome.storage.session.set({ openNotesForKeyword: keyword });
			chrome.action.openPopup();
			return;
		}

		const normalizeForCompare = (url) => {
			try {
				const u = new URL(url);
				return `${u.origin}${u.pathname.replace(/\/+$/, '')}`;
			} catch {
				return url;
			}
		};
		if (normalizeForCompare(stripQueryParams(details.url)) !== normalizeForCompare(pending.url)) {
			return;
		}

		await chrome.storage.session.remove(pendingKey);

		let tab;
		try {
			tab = await chrome.tabs.get(details.tabId);
		} catch {
			return;
		}

		const { keyword, description } = extractSuggestionFieldsFromTitle(tab.title, pending.url);

		if (await urlHasExistingLink(pending.url)) {
			await chrome.storage.local.set({ [pending.suggestionKey]: true });
			return;
		}

		const existing = await chrome.storage.sync.get(keyword);
		if (existing[keyword]) {
			await chrome.storage.local.set({ [pending.suggestionKey]: true });
			return;
		}

		await chrome.storage.local.set({ [pending.suggestionKey]: true });

		await chrome.storage.session.set({
			suggestedGoLink: {
				url: pending.url,
				keyword,
				description,
			},
		});

		chrome.action.openPopup();
	});

	// Clean up stale pending auto-suggestion entries when a tab is closed.
	chrome.tabs.onRemoved.addListener(async (tabId) => {
		await chrome.storage.session.remove(`pendingAutoSuggestion_${tabId}`);
	});

	// Handle lp/<keyword> navigation pattern so users can type "lp/keyword" in the address bar
	// to jump directly to a saved lily pad without the omnibox Tab trigger.
	// Covers two cases:
	//   1. Chrome navigates to http://lp/<keyword> (local-hostname interpretation)
	//   2. Chrome searches Google for "lp/<keyword>" (most common: no TLD → search)
	chrome.webNavigation.onBeforeNavigate.addListener(async (details) => {
		if (details.frameId !== 0) return;

		let keyword = null;

		try {
			const navUrl = new URL(details.url);

			// Case 1: Direct navigation to http://lp/<keyword>
			if (navUrl.hostname === OMNIBOX_KEYWORD) {
				const path = navUrl.pathname.replace(/^\/+/, '').trim();
				if (path) keyword = path;
			}
			// Case 2: Google search whose query is exactly "lp/<keyword>"
			else if (
				(navUrl.hostname === 'www.google.com' || navUrl.hostname === 'google.com') &&
				navUrl.pathname === '/search'
			) {
				const query = navUrl.searchParams.get('q') || '';
				const match = query.match(/^lp\/(\S+)$/);
				if (match) keyword = match[1];
			}
		} catch {
			return;
		}

		if (!keyword) return;

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
				await chrome.storage.session.remove([
					'pendingUrl',
					'pendingTitle',
					'suggestedGoLink',
					'openNotesForKeyword',
					'openNotesForCurrentPage',
					'openDetailForKeyword',
				]);
			});
		}
	});

	chrome.runtime.onInstalled.addListener(migrateStorageKeys);
	chrome.runtime.onStartup.addListener(migrateStorageKeys);
});

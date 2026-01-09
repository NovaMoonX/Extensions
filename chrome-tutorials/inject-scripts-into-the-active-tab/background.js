chrome.runtime.onInstalled.addListener(() => {
	chrome.action.setBadgeText({
		text: '',
	});
});

const search = 'https://www.google.com/search';

// Apply CSS to Google search results pages AFTER they load
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
	if (changeInfo.status === 'complete' && tab.url?.startsWith(search)) {
		const state = await chrome.action.getBadgeText({ tabId });

		// Default to ON if badge is empty
		const effectiveState = state || 'ON';

		// Set badge if it's empty
		if (!state) {
			await chrome.action.setBadgeText({ tabId, text: 'ON' });
		}
		if (effectiveState === 'ON') {
			await chrome.scripting.insertCSS({
				files: ['simple-mode.css'],
				target: { tabId },
			});
		}
	} else if (tab.url && !tab.url.startsWith(search)) {
		// Clear badge text for non-Google search pages
		await chrome.action.setBadgeText({ tabId, text: '' });
	}
});

// Toggle CSS on/off when the extension action is clicked (or shortcut used)
chrome.action.onClicked.addListener(async (tab) => {
	if (tab.url.startsWith(search)) {
		// Retrieve the action badge to check if the extension is 'ON' or 'OFF'
		const prevState = await chrome.action.getBadgeText({ tabId: tab.id });
		// Next state will always be the opposite
		const nextState = prevState === 'ON' ? 'OFF' : 'ON';

		if (nextState === 'ON') {
			// Insert the CSS file when the user turns the extension on
			await chrome.scripting.insertCSS({
				files: ['simple-mode.css'],
				target: { tabId: tab.id },
			});
		} else if (nextState === 'OFF') {
			// Remove the CSS file when the user turns the extension off
			await chrome.scripting.removeCSS({
				files: ['simple-mode.css'],
				target: { tabId: tab.id },
			});
		}

		// Set the action badge to the next state
		await chrome.action.setBadgeText({
			tabId: tab.id,
			text: nextState,
		});
	}
});
